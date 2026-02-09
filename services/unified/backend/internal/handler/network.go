package handler

import (
	"net/http"
	"strconv"

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
