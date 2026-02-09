package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RevenueReport handles GET /v1/agents/:agent_id/revenue.
func (h *Handler) RevenueReport(c *gin.Context) {
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

	period := c.DefaultQuery("period", "monthly")
	if period != "monthly" && period != "weekly" {
		period = "monthly"
	}

	cacheKey := fmt.Sprintf("agent:%s:revenue:%s", c.Param("agent_id"), period)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	report, err := h.revenueAnalytics.GetRevenueReport(c.Request.Context(), dbID, period)
	if err != nil {
		h.logger.Error("failed to get revenue report", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get revenue report"})
		return
	}

	data, _ := json.Marshal(report)
	h.cache.Set(c.Request.Context(), cacheKey, data, 30*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}
