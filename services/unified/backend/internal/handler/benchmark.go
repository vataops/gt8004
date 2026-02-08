package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GetBenchmark handles GET /v1/benchmark?category=
func (h *Handler) GetBenchmark(c *gin.Context) {
	category := c.Query("category")

	if category == "" {
		// Return list of categories.
		categories, err := h.store.GetBenchmarkCategories(c.Request.Context())
		if err != nil {
			h.logger.Error("failed to get benchmark categories", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get categories"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"categories": categories})
		return
	}

	entries, err := h.store.GetBenchmarkByCategory(c.Request.Context(), category)
	if err != nil {
		h.logger.Error("failed to get benchmark", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get benchmark"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"category": category,
		"rankings": entries,
		"total":    len(entries),
	})
}
