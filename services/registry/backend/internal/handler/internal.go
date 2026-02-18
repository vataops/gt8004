package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// InternalGetAgent handles GET /internal/agents/:slug
// Used by Gateway service to look up agent origin endpoint.
func (h *Handler) InternalGetAgent(c *gin.Context) {
	slug := c.Param("slug")
	agent, err := h.store.GetAgentByID(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":              agent.ID,
		"agent_id":        agent.AgentID,
		"origin_endpoint": agent.OriginEndpoint,
	})
}

// InternalValidateKey handles POST /internal/validate-key
// Used by Analytics service to validate API keys.
func (h *Handler) InternalValidateKey(c *gin.Context) {
	var req struct {
		KeyHash string `json:"key_hash"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.KeyHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key_hash required"})
		return
	}
	auth, err := h.store.ValidateAPIKey(c.Request.Context(), req.KeyHash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"agent_db_id": auth.AgentDBID,
		"agent_id":    auth.AgentID,
	})
}

// InternalUpdateAgentStats handles PUT /internal/agents/:id/stats
// Used by Analytics enricher to update agent aggregate stats.
func (h *Handler) InternalUpdateAgentStats(c *gin.Context) {
	idStr := c.Param("id")
	dbID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uuid"})
		return
	}
	var req struct {
		RequestCount int     `json:"request_count"`
		Revenue      float64 `json:"revenue"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.store.UpdateAgentStats(c.Request.Context(), dbID, req.RequestCount, req.Revenue); err != nil {
		h.logger.Error("failed to update agent stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update stats"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// InternalUpdateCustomersCount handles PUT /internal/agents/:id/customers-count
func (h *Handler) InternalUpdateCustomersCount(c *gin.Context) {
	idStr := c.Param("id")
	dbID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uuid"})
		return
	}
	var req struct {
		Count int `json:"count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.store.UpdateAgentTotalCustomers(c.Request.Context(), dbID, req.Count); err != nil {
		h.logger.Error("failed to update customers count", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// InternalReconcile handles POST /internal/reconcile
// Clears ERC-8004 fields for agents whose tokens no longer exist on-chain.
func (h *Handler) InternalReconcile(c *gin.Context) {
	count, err := h.store.ReconcileERC8004(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to reconcile erc8004", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "reconciliation failed"})
		return
	}
	h.logger.Info("erc8004 reconciliation complete", zap.Int64("cleaned", count))
	c.JSON(http.StatusOK, gin.H{"cleaned": count})
}
