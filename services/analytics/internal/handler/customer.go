package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ListCustomers handles GET /v1/agents/:agent_id/customers.
func (h *Handler) ListCustomers(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
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
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
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

// CustomerLogs handles GET /v1/agents/:agent_id/customers/:customer_id/logs.
func (h *Handler) CustomerLogs(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	customerID := c.Param("customer_id")
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer_id is required"})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:customer:%s:logs:%d", c.Param("agent_id"), customerID, limit)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	logs, err := h.store.GetCustomerLogs(c.Request.Context(), dbID, customerID, limit)
	if err != nil {
		h.logger.Error("failed to get customer logs", zap.Error(err), zap.String("customer_id", customerID))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get customer logs"})
		return
	}

	resp := gin.H{"logs": logs, "total": len(logs)}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 5*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// CustomerTools handles GET /v1/agents/:agent_id/customers/:customer_id/tools.
func (h *Handler) CustomerTools(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	customerID := c.Param("customer_id")
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer_id is required"})
		return
	}

	cacheKey := fmt.Sprintf("agent:%s:customer:%s:tools", c.Param("agent_id"), customerID)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	tools, err := h.store.GetCustomerToolUsage(c.Request.Context(), dbID, customerID)
	if err != nil {
		h.logger.Error("failed to get customer tools", zap.Error(err), zap.String("customer_id", customerID))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get customer tool usage"})
		return
	}

	resp := gin.H{"tools": tools}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 30*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// CustomerDailyStats handles GET /v1/agents/:agent_id/customers/:customer_id/daily.
func (h *Handler) CustomerDailyStats(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	customerID := c.Param("customer_id")
	if customerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer_id is required"})
		return
	}

	days := 30
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:customer:%s:daily:%d", c.Param("agent_id"), customerID, days)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	stats, err := h.store.GetCustomerDailyStats(c.Request.Context(), dbID, customerID, days)
	if err != nil {
		h.logger.Error("failed to get customer daily stats", zap.Error(err), zap.String("customer_id", customerID))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get customer daily stats"})
		return
	}

	resp := gin.H{"stats": stats}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 30*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}
