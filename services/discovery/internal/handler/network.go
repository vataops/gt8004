package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/GT8004/gt8004-discovery/internal/config"
	"go.uber.org/zap"
)

// ListNetworkAgents handles GET /v1/network/agents
func (h *Handler) ListNetworkAgents(c *gin.Context) {
	var chainIDs []int
	if raw := c.Query("chain_id"); raw != "" {
		if id, err := strconv.Atoi(raw); err == nil && id > 0 {
			chainIDs = []int{id}
		}
	}
	// Default to configured SupportedNetworks when no chain_id specified.
	if len(chainIDs) == 0 {
		for id := range config.SupportedNetworks {
			chainIDs = append(chainIDs, id)
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

	sort := c.Query("sort") // "newest" or "oldest"

	agents, total, err := h.store.ListNetworkAgents(c.Request.Context(), chainIDs, search, limit, offset, sort)
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

	agent, err := h.store.GetNetworkAgent(c.Request.Context(), chainID, tokenID)
	if err != nil {
		h.logger.Error("failed to get network agent", zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// GetNetworkStats handles GET /v1/network/stats
func (h *Handler) GetNetworkStats(c *gin.Context) {
	var chainIDs []int
	for id := range config.SupportedNetworks {
		chainIDs = append(chainIDs, id)
	}
	stats, err := h.store.GetNetworkAgentStats(c.Request.Context(), chainIDs)
	if err != nil {
		h.logger.Error("failed to get network stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get network stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
