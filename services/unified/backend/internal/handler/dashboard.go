package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// DashboardOverview handles GET /v1/dashboard/overview.
func (h *Handler) DashboardOverview(c *gin.Context) {
	overview, err := h.store.GetDashboardOverview(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to get dashboard overview", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get overview"})
		return
	}

	c.JSON(http.StatusOK, overview)
}
