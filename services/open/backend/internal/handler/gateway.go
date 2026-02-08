package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// EnableGateway handles POST /v1/agents/:agent_id/gateway/enable
func (h *Handler) EnableGateway(c *gin.Context) {
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

	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, true); err != nil {
		h.logger.Error("failed to enable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable gateway"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"gateway_enabled": true})
}

// DisableGateway handles POST /v1/agents/:agent_id/gateway/disable
func (h *Handler) DisableGateway(c *gin.Context) {
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

	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, false); err != nil {
		h.logger.Error("failed to disable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable gateway"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"gateway_enabled": false})
}

// GatewayProxy handles ANY /gateway/:slug/*path -- proxies to agent's origin.
func (h *Handler) GatewayProxy(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Param("path")
	if path == "" {
		path = "/"
	}
	// Remove leading slash duplication
	path = "/" + strings.TrimLeft(path, "/")

	agent, err := h.store.GetAgentByID(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	if !agent.GatewayEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "gateway not enabled for this agent"})
		return
	}

	if h.rateLimiter != nil && !h.rateLimiter.Allow(slug) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
		return
	}

	h.proxy.Forward(c.Writer, c.Request, agent, path)
}
