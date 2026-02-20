package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/store"
)

// defaultChainID is Base Sepolia.
const defaultChainID = 84532

func (h *Handler) resolveChainID(c *gin.Context) int {
	if raw := c.Query("chain_id"); raw != "" {
		if id, err := strconv.Atoi(raw); err == nil {
			return id
		}
	}
	return defaultChainID
}

func (h *Handler) AgentDescriptor(c *gin.Context) {
	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}
	client := h.erc8004Registry.Default()
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}
	descriptor := client.BuildDescriptor()
	c.JSON(http.StatusOK, descriptor)
}

// VerifyToken handles GET /v1/erc8004/token/:token_id
// Queries the on-chain ERC-8004 registry for token ownership and agent URI.
func (h *Handler) VerifyToken(c *gin.Context) {
	tokenIDStr := c.Param("token_id")
	tokenID, err := strconv.ParseInt(tokenIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token_id"})
		return
	}

	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}

	chainID := h.resolveChainID(c)
	client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported chain_id"})
		return
	}

	cacheKey := fmt.Sprintf("erc8004:token:%d:%d", tokenID, chainID)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	owner, err := client.VerifyOwnership(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"exists":   false,
			"token_id": tokenID,
		})
		return
	}

	agentURI, _ := client.GetAgentURI(c.Request.Context(), tokenID)

	resp := gin.H{"exists": true, "token_id": tokenID, "owner": owner, "agent_uri": agentURI}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 1*time.Hour)
	c.Data(http.StatusOK, "application/json", data)
}

// ListTokensByOwner handles GET /v1/erc8004/tokens/:address
// Returns all ERC-8004 tokens owned by the given address.
// Uses the discovery-synced network_agents table (fast DB query) with
// an on-chain RPC fallback when the DB returns no results.
func (h *Handler) ListTokensByOwner(c *gin.Context) {
	address := c.Param("address")
	if address == "" || !strings.HasPrefix(address, "0x") || len(address) != 42 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ethereum address"})
		return
	}

	chainID := h.resolveChainID(c)

	cacheKey := fmt.Sprintf("erc8004:tokens:%s:%d", address, chainID)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	// Fast path: query discovery-synced DB
	dbTokens, err := h.store.GetNetworkTokensByOwner(c.Request.Context(), address, chainID)
	if err != nil {
		h.logger.Warn("DB token lookup failed", zap.Error(err))
	}

	// If DB has results, check if on-chain balance matches.
	// When new tokens were minted but not yet synced, do a quick scan of
	// recent blocks (~50K, 1 RPC call) to supplement — NOT the full 2M-block scan.
	if len(dbTokens) > 0 && h.erc8004Registry != nil {
		client, clientErr := h.erc8004Registry.GetClient(chainID)
		if clientErr == nil {
			balance, balErr := client.BalanceOf(c.Request.Context(), address)
			if balErr == nil && balance > int64(len(dbTokens)) {
				// Newly minted tokens not yet synced — scan recent blocks only
				recent, _ := client.GetRecentTokensByOwner(c.Request.Context(), address, 50000)
				if len(recent) > 0 {
					dbSet := make(map[int64]bool, len(dbTokens))
					for _, t := range dbTokens {
						dbSet[t.TokenID] = true
					}
					for _, t := range recent {
						if !dbSet[t.TokenID] {
							dbTokens = append(dbTokens, store.NetworkToken{
								TokenID:  t.TokenID,
								AgentURI: t.AgentURI,
							})
						}
					}
				}
			}
		}
	}

	if len(dbTokens) > 0 {
		resp := gin.H{"tokens": dbTokens}
		data, _ := json.Marshal(resp)
		h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
		c.Data(http.StatusOK, "application/json", data)
		return
	}

	// Slow path: full on-chain RPC scan (DB completely empty)
	if h.erc8004Registry == nil {
		c.JSON(http.StatusOK, gin.H{"tokens": []any{}})
		return
	}
	client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"tokens": []any{}})
		return
	}

	tokens, err := client.GetTokensByOwner(c.Request.Context(), address)
	if err != nil {
		h.logger.Warn("RPC token scan failed", zap.Error(err))
		c.JSON(http.StatusOK, gin.H{"tokens": []any{}})
		return
	}

	resp := gin.H{"tokens": tokens}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
	c.Data(http.StatusOK, "application/json", data)
}

// GetReputationSummary handles GET /v1/erc8004/reputation/:token_id/summary
func (h *Handler) GetReputationSummary(c *gin.Context) {
	tokenID, err := strconv.ParseInt(c.Param("token_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token_id"})
		return
	}
	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}

	chainID := h.resolveChainID(c)
	client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported chain_id"})
		return
	}

	cacheKey := fmt.Sprintf("erc8004:reputation:summary:%d:%d", chainID, tokenID)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	score, count, err := client.GetReputationSummary(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"token_id": tokenID, "chain_id": chainID, "count": 0, "score": 0})
		return
	}

	resp := gin.H{"token_id": tokenID, "chain_id": chainID, "count": count, "score": score}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
	c.Data(http.StatusOK, "application/json", data)
}

// GetReputationFeedbacks handles GET /v1/erc8004/reputation/:token_id/feedbacks
func (h *Handler) GetReputationFeedbacks(c *gin.Context) {
	tokenID, err := strconv.ParseInt(c.Param("token_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token_id"})
		return
	}
	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}

	chainID := h.resolveChainID(c)
	client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported chain_id"})
		return
	}

	limit := 10
	if raw := c.Query("limit"); raw != "" {
		if l, err := strconv.Atoi(raw); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	cacheKey := fmt.Sprintf("erc8004:reputation:feedbacks:%d:%d:%d", chainID, tokenID, limit)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	feedbacks, err := client.ReadRecentFeedbacks(c.Request.Context(), tokenID, limit)
	if err != nil {
		feedbacks = nil
	}
	if feedbacks == nil {
		feedbacks = []erc8004.Feedback{}
	}

	resp := gin.H{"token_id": tokenID, "chain_id": chainID, "feedbacks": feedbacks}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
	c.Data(http.StatusOK, "application/json", data)
}
