package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// PerformanceReport handles GET /v1/agents/:agent_id/performance?window=24h
func (h *Handler) PerformanceReport(c *gin.Context) {
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

	// Parse window query param (default "24h")
	windowHours := 24
	if w := c.Query("window"); w != "" {
		windowHours = parseWindowHours(w)
	}

	report, err := h.perfAnalytics.GetPerformanceReport(c.Request.Context(), dbID, windowHours)
	if err != nil {
		h.logger.Error("failed to get performance report", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get performance report"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// parseWindowHours parses a window string like "24h", "1h", "72h" into hours.
// Falls back to 24 hours on invalid input.
func parseWindowHours(w string) int {
	w = strings.TrimSpace(strings.ToLower(w))

	if strings.HasSuffix(w, "h") {
		w = strings.TrimSuffix(w, "h")
	}

	hours, err := strconv.Atoi(w)
	if err != nil || hours <= 0 {
		return 24
	}

	return hours
}
