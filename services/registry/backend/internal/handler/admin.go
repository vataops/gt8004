package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *Handler) AdminOverview(c *gin.Context) {
	overview, err := h.store.GetDashboardOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, overview)
}

func (h *Handler) AdminListAgents(c *gin.Context) {
	agents, err := h.store.SearchAgents(c.Request.Context(), "", "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

func (h *Handler) AdminGetAgent(c *gin.Context) {
	id := c.Param("id")
	agent, err := h.store.GetAgentByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
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
