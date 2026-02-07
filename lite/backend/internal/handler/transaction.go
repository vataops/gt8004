package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
)

func (h *Handler) CreateTransaction(c *gin.Context) {
	channelID := c.Param("id")

	var req channel.TxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.engine.SendTransaction(c.Request.Context(), channelID, req)
	if err != nil {
		h.logger.Error("transaction failed", zap.Error(err), zap.String("channel", channelID))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) ChannelWebSocket(c *gin.Context) {
	// TODO: WebSocket upgrade for real-time channel events
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}
