package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (h *Handler) AdminOverview(c *gin.Context) {
	overview, err := h.store.GetOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, overview)
}

func (h *Handler) AdminListChannels(c *gin.Context) {
	channels, err := h.store.ListChannels(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

func (h *Handler) AdminGetChannel(c *gin.Context) {
	id := c.Param("id")
	channel, err := h.store.GetChannel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return
	}
	c.JSON(http.StatusOK, channel)
}

func (h *Handler) AdminChannelTransactions(c *gin.Context) {
	id := c.Param("id")
	txs, err := h.store.ListTransactionsByChannel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"transactions": txs})
}

func (h *Handler) AdminListAgents(c *gin.Context) {
	agents, err := h.store.ListAgents(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

func (h *Handler) AdminGetAgent(c *gin.Context) {
	id := c.Param("id")
	agent, err := h.store.GetAgent(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *Handler) AdminEscrow(c *gin.Context) {
	escrow, err := h.store.GetEscrowOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, escrow)
}

func (h *Handler) AdminListEvents(c *gin.Context) {
	events, err := h.store.ListEvents(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events})
}

// AdminEventsWebSocket upgrades to WebSocket and streams all system events in real-time.
func (h *Handler) AdminEventsWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("admin ws upgrade failed", zap.Error(err))
		return
	}

	h.logger.Info("ws: admin client connected")
	h.hub.SubscribeGlobal(conn) // blocks until client disconnects
}
