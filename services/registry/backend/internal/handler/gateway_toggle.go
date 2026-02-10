package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (h *Handler) EnableGateway(c *gin.Context) {
	dbID, ok := h.resolveViewableAgent(c)
	if !ok {
		return
	}
	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, true); err != nil {
		h.logger.Error("failed to enable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable gateway"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"gateway_enabled": true})
}

func (h *Handler) DisableGateway(c *gin.Context) {
	dbID, ok := h.resolveViewableAgent(c)
	if !ok {
		return
	}
	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, false); err != nil {
		h.logger.Error("failed to disable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable gateway"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"gateway_enabled": false})
}
