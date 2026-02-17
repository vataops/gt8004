package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// DashboardOverview handles GET /v1/dashboard/overview.
func (h *Handler) DashboardOverview(c *gin.Context) {
	const cacheKey = "overview"

	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	overview, err := h.store.GetDashboardOverview(c.Request.Context(), h.chainIDs)
	if err != nil {
		h.logger.Error("failed to get dashboard overview", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get overview"})
		return
	}

	data, _ := json.Marshal(overview)
	h.cache.Set(c.Request.Context(), cacheKey, data, 10*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}
