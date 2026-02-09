package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ListNetworkAgents handles GET /v1/network/agents
func (h *Handler) ListNetworkAgents(c *gin.Context) {
	chainID := 0
	if raw := c.Query("chain_id"); raw != "" {
		if id, err := strconv.Atoi(raw); err == nil {
			chainID = id
		}
	}

	search := c.Query("search")

	limit := 100
	if raw := c.Query("limit"); raw != "" {
		if l, err := strconv.Atoi(raw); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if raw := c.Query("offset"); raw != "" {
		if o, err := strconv.Atoi(raw); err == nil && o >= 0 {
			offset = o
		}
	}

	agents, total, err := h.store.ListNetworkAgents(c.Request.Context(), chainID, search, limit, offset)
	if err != nil {
		h.logger.Error("failed to list network agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list network agents"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  total,
	})
}

// GetNetworkAgent handles GET /v1/network/agents/:chain_id/:token_id
func (h *Handler) GetNetworkAgent(c *gin.Context) {
	chainID, err := strconv.Atoi(c.Param("chain_id"))
	if err != nil || chainID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chain_id"})
		return
	}

	tokenID, err := strconv.ParseInt(c.Param("token_id"), 10, 64)
	if err != nil || tokenID < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token_id"})
		return
	}

	cacheKey := fmt.Sprintf("network:agent:%d:%d", chainID, tokenID)
	if h.cache != nil {
		if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
	}

	agent, err := h.store.GetNetworkAgent(c.Request.Context(), chainID, tokenID)
	if err != nil {
		h.logger.Error("failed to get network agent", zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	if h.cache != nil {
		if data, err := json.Marshal(agent); err == nil {
			h.cache.Set(c.Request.Context(), cacheKey, data, 60*time.Second)
		}
	}

	c.JSON(http.StatusOK, agent)
}

// GetNetworkStats handles GET /v1/network/stats
func (h *Handler) GetNetworkStats(c *gin.Context) {
	stats, err := h.store.GetNetworkAgentStats(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to get network stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get network stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
