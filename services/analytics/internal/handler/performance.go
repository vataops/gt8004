package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PerformanceReport handles GET /v1/agents/:agent_id/performance?window=24h
func (h *Handler) PerformanceReport(c *gin.Context) {
	dbID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	// Parse window query param (default "24h")
	windowHours := 24
	if w := c.Query("window"); w != "" {
		windowHours = parseWindowHours(w)
	}

	cacheKey := fmt.Sprintf("agent:%s:perf:%d", c.Param("agent_id"), windowHours)

	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	report, err := h.perfAnalytics.GetPerformanceReport(c.Request.Context(), dbID, windowHours)
	if err != nil {
		h.logger.Error("failed to get performance report", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get performance report"})
		return
	}

	data, _ := json.Marshal(report)
	h.cache.Set(c.Request.Context(), cacheKey, data, 10*time.Second)
	c.Data(http.StatusOK, "application/json", data)
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
