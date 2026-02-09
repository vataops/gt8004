package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ListLogs handles GET /v1/agents/:agent_id/logs?limit=50
func (h *Handler) ListLogs(c *gin.Context) {
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
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:logs:%d", c.Param("agent_id"), limit)

	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	logs, err := h.store.GetRecentRequests(c.Request.Context(), dbID, limit)
	if err != nil {
		h.logger.Error("failed to list logs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list logs"})
		return
	}

	resp := gin.H{
		"logs":  logs,
		"total": len(logs),
	}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}
