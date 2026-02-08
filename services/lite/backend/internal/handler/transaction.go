package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
	"github.com/AEL/aes-common/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

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

	// Broadcast TX event to channel subscribers + admin
	h.hub.Broadcast(ws.Event{
		Type:      "tx_confirmed",
		ChannelID: channelID,
		Payload:   result,
	})

	c.JSON(http.StatusOK, result)
}

// ChannelWebSocket upgrades to WebSocket and streams channel events in real-time.
func (h *Handler) ChannelWebSocket(c *gin.Context) {
	channelID := c.Param("id")

	// Verify channel exists
	_, err := h.engine.GetChannel(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("ws upgrade failed", zap.Error(err))
		return
	}

	h.logger.Info("ws: client connected", zap.String("channel", channelID))
	h.hub.Subscribe(channelID, conn) // blocks until client disconnects
}
