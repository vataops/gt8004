package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	owner, err := client.VerifyOwnership(c.Request.Context(), tokenID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"exists":   false,
			"token_id": tokenID,
			"error":    err.Error(),
		})
		return
	}

	agentURI, _ := client.GetAgentURI(c.Request.Context(), tokenID)

	c.JSON(http.StatusOK, gin.H{
		"exists":    true,
		"token_id":  tokenID,
		"owner":     owner,
		"agent_uri": agentURI,
	})
}

// ListTokensByOwner handles GET /v1/erc8004/tokens/:address
// Returns all ERC-8004 tokens owned by the given address.
func (h *Handler) ListTokensByOwner(c *gin.Context) {
	address := c.Param("address")
	if address == "" || !strings.HasPrefix(address, "0x") || len(address) != 42 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ethereum address"})
		return
	}

	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}

	chainID := h.resolveChainID(c)
	client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokens, err := client.GetTokensByOwner(c.Request.Context(), address)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"tokens": []any{}, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tokens": tokens})
}
