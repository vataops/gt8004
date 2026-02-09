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

// ListCustomers handles GET /v1/agents/:agent_id/customers.
func (h *Handler) ListCustomers(c *gin.Context) {
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
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:customers:%d:%d", c.Param("agent_id"), limit, offset)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	customers, total, err := h.store.GetCustomers(c.Request.Context(), dbID, limit, offset)
	if err != nil {
		h.logger.Error("failed to list customers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list customers"})
		return
	}

	resp := gin.H{"customers": customers, "total": total}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 30*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// GetCustomer handles GET /v1/agents/:agent_id/customers/:customer_id.
func (h *Handler) GetCustomer(c *gin.Context) {
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

	customerID := c.Param("customer_id")
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer_id is required"})
		return
	}

	customer, err := h.store.GetCustomer(c.Request.Context(), dbID, customerID)
	if err != nil {
		h.logger.Error("failed to get customer", zap.Error(err), zap.String("customer_id", customerID))
		c.JSON(http.StatusNotFound, gin.H{"error": "customer not found"})
		return
	}

	c.JSON(http.StatusOK, customer)
}
