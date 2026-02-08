package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/AEL/ael-open/internal/store"
)

// CreateAlert handles POST /v1/agents/:agent_id/alerts.
func (h *Handler) CreateAlert(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	var req struct {
		Name          string  `json:"name" binding:"required"`
		Type          string  `json:"type" binding:"required"`
		Metric        string  `json:"metric" binding:"required"`
		Operator      string  `json:"operator" binding:"required"`
		Threshold     float64 `json:"threshold"`
		WindowMinutes int     `json:"window_minutes"`
		WebhookURL    *string `json:"webhook_url"`
		Enabled       *bool   `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	windowMinutes := 60
	if req.WindowMinutes > 0 {
		windowMinutes = req.WindowMinutes
	}

	rule := &store.AlertRule{
		AgentID:       dbID,
		Name:          req.Name,
		Type:          req.Type,
		Metric:        req.Metric,
		Operator:      req.Operator,
		Threshold:     req.Threshold,
		WindowMinutes: windowMinutes,
		WebhookURL:    req.WebhookURL,
		Enabled:       enabled,
	}

	if err := h.store.CreateAlertRule(c.Request.Context(), rule); err != nil {
		h.logger.Error("failed to create alert rule", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create alert rule"})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// ListAlerts handles GET /v1/agents/:agent_id/alerts.
func (h *Handler) ListAlerts(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	rules, err := h.store.GetAlertRules(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to list alert rules", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list alert rules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alerts": rules})
}

// UpdateAlert handles PUT /v1/agents/:agent_id/alerts/:alert_id.
func (h *Handler) UpdateAlert(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	alertIDStr := c.Param("alert_id")
	alertID, err := uuid.Parse(alertIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert_id"})
		return
	}

	// Verify the rule belongs to this agent
	existing, err := h.store.GetAlertRule(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert rule not found"})
		return
	}

	if existing.AgentID != dbID {
		c.JSON(http.StatusForbidden, gin.H{"error": "alert rule does not belong to this agent"})
		return
	}

	var req struct {
		Name          *string  `json:"name"`
		Type          *string  `json:"type"`
		Metric        *string  `json:"metric"`
		Operator      *string  `json:"operator"`
		Threshold     *float64 `json:"threshold"`
		WindowMinutes *int     `json:"window_minutes"`
		WebhookURL    *string  `json:"webhook_url"`
		Enabled       *bool    `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Apply partial updates
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Type != nil {
		existing.Type = *req.Type
	}
	if req.Metric != nil {
		existing.Metric = *req.Metric
	}
	if req.Operator != nil {
		existing.Operator = *req.Operator
	}
	if req.Threshold != nil {
		existing.Threshold = *req.Threshold
	}
	if req.WindowMinutes != nil {
		existing.WindowMinutes = *req.WindowMinutes
	}
	if req.WebhookURL != nil {
		existing.WebhookURL = req.WebhookURL
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := h.store.UpdateAlertRule(c.Request.Context(), existing); err != nil {
		h.logger.Error("failed to update alert rule", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update alert rule"})
		return
	}

	c.JSON(http.StatusOK, existing)
}

// DeleteAlert handles DELETE /v1/agents/:agent_id/alerts/:alert_id.
func (h *Handler) DeleteAlert(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	alertIDStr := c.Param("alert_id")
	alertID, err := uuid.Parse(alertIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert_id"})
		return
	}

	// Verify the rule belongs to this agent
	existing, err := h.store.GetAlertRule(c.Request.Context(), alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert rule not found"})
		return
	}

	if existing.AgentID != dbID {
		c.JSON(http.StatusForbidden, gin.H{"error": "alert rule does not belong to this agent"})
		return
	}

	if err := h.store.DeleteAlertRule(c.Request.Context(), alertID); err != nil {
		h.logger.Error("failed to delete alert rule", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete alert rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "alert rule deleted"})
}

// AlertHistory handles GET /v1/agents/:agent_id/alerts/history.
func (h *Handler) AlertHistory(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	history, err := h.store.GetAlertHistory(c.Request.Context(), dbID, limit)
	if err != nil {
		h.logger.Error("failed to get alert history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get alert history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"history": history})
}
