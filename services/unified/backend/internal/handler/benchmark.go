package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GetBenchmark handles GET /v1/benchmark?category=
func (h *Handler) GetBenchmark(c *gin.Context) {
	category := c.Query("category")

	cacheKey := fmt.Sprintf("benchmark:%s", category)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	if category == "" {
		categories, err := h.store.GetBenchmarkCategories(c.Request.Context())
		if err != nil {
			h.logger.Error("failed to get benchmark categories", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get categories"})
			return
		}
		resp := gin.H{"categories": categories}
		data, _ := json.Marshal(resp)
		h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
		c.Data(http.StatusOK, "application/json", data)
		return
	}

	entries, err := h.store.GetBenchmarkByCategory(c.Request.Context(), category)
	if err != nil {
		h.logger.Error("failed to get benchmark", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get benchmark"})
		return
	}

	resp := gin.H{"category": category, "rankings": entries, "total": len(entries)}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Minute)
	c.Data(http.StatusOK, "application/json", data)
}
