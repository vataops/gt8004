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

	// Primary: on-chain RPC (source of truth for ownership)
	// The 5-minute cache above protects against excessive RPC calls.
	if h.erc8004Registry != nil {
		if client, err := h.erc8004Registry.GetClient(chainID); err == nil {
			if tokens, err := client.GetTokensByOwner(c.Request.Context(), address); err == nil {
				resp := gin.H{"tokens": tokens}
				data, _ := json.Marshal(resp)
				h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
				c.Data(http.StatusOK, "application/json", data)
				return
			}
			h.logger.Warn("RPC token lookup failed, falling back to DB", zap.Error(err))
		}
	}

	// Fallback: discovery-synced DB (when RPC is unavailable)
	dbTokens, err := h.store.GetNetworkTokensByOwner(c.Request.Context(), address, chainID)
	if err != nil {
		h.logger.Warn("DB token lookup also failed", zap.Error(err))
		c.JSON(http.StatusOK, gin.H{"tokens": []any{}})
		return
	}

	resp := gin.H{"tokens": dbTokens}
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
