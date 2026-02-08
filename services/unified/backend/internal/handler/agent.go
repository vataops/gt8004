package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/store"
)

type Pricing struct {
	Model    string `json:"model"`
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

type RegisterRequest struct {
	AgentID        string   `json:"agent_id" binding:"required"`
	Name           string   `json:"name"`
	OriginEndpoint string   `json:"origin_endpoint" binding:"required"`
	Protocols      []string `json:"protocols"`
	Category       string   `json:"category"`
	Pricing        *Pricing `json:"pricing"`
}

type RegisterResponse struct {
	AgentID      string `json:"agent_id"`
	GT8004Endpoint  string `json:"gt8004_endpoint"`
	DashboardURL string `json:"dashboard_url"`
	APIKey       string `json:"api_key"`
	Status       string `json:"status"`
}

// RegisterAgent handles POST /v1/agents/register.
func (h *Handler) RegisterAgent(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent := &store.Agent{
		AgentID:        req.AgentID,
		Name:           req.Name,
		OriginEndpoint: req.OriginEndpoint,
		Protocols:      req.Protocols,
		Category:       req.Category,
		Status:         "active",
	}

	if req.Pricing != nil {
		agent.PricingModel = req.Pricing.Model
		agent.PricingCurrency = req.Pricing.Currency
	}

	gt8004Endpoint := fmt.Sprintf("/v1/agents/%s", req.AgentID)
	agent.GT8004Endpoint = gt8004Endpoint

	if err := h.store.CreateAgent(c.Request.Context(), agent); err != nil {
		h.logger.Error("failed to create agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register agent"})
		return
	}

	// Generate API key
	rawKey, err := h.store.CreateAPIKey(c.Request.Context(), agent.ID)
	if err != nil {
		h.logger.Error("failed to create api key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate api key"})
		return
	}

	resp := RegisterResponse{
		AgentID:      req.AgentID,
		GT8004Endpoint:  gt8004Endpoint,
		DashboardURL: fmt.Sprintf("/dashboard/agents/%s", req.AgentID),
		APIKey:       rawKey,
		Status:       "active",
	}

	c.JSON(http.StatusCreated, resp)
}

// AgentStats handles GET /v1/agents/:agent_id/stats.
func (h *Handler) AgentStats(c *gin.Context) {
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

	stats, err := h.store.GetAgentStats(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get agent stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// AgentDailyStats handles GET /v1/agents/:agent_id/stats/daily.
func (h *Handler) AgentDailyStats(c *gin.Context) {
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

	days := 30
	if d := c.Query("days"); d != "" {
		parsed, err := strconv.Atoi(d)
		if err == nil && parsed > 0 && parsed <= 365 {
			days = parsed
		}
	}

	stats, err := h.store.GetDailyStats(c.Request.Context(), dbID, days)
	if err != nil {
		h.logger.Error("failed to get daily stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get daily stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// GetMe handles GET /v1/agents/me — returns the authenticated agent's profile.
func (h *Handler) GetMe(c *gin.Context) {
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

	agent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get agent"})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// UpdateOriginEndpoint handles PUT /v1/agents/me/endpoint.
func (h *Handler) UpdateOriginEndpoint(c *gin.Context) {
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

	var req struct {
		OriginEndpoint string `json:"origin_endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.store.UpdateOriginEndpoint(c.Request.Context(), dbID, req.OriginEndpoint); err != nil {
		h.logger.Error("failed to update origin endpoint", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update endpoint"})
		return
	}

	agent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get agent"})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// ListWalletAgents handles GET /v1/agents/wallet/:address (public).
// Returns all agents linked to the given EVM wallet address.
func (h *Handler) ListWalletAgents(c *gin.Context) {
	address := c.Param("address")
	if address == "" || len(address) != 42 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ethereum address"})
		return
	}

	agents, err := h.store.GetAgentsByEVMAddress(c.Request.Context(), address)
	if err != nil {
		h.logger.Error("failed to list wallet agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list agents"})
		return
	}
	if agents == nil {
		agents = []store.Agent{}
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  len(agents),
	})
}

// SearchAgents handles GET /v1/agents/search (Phase 1D - public).
func (h *Handler) SearchAgents(c *gin.Context) {
	category := c.Query("category")
	protocol := c.Query("protocol")
	sortParam := c.DefaultQuery("sort", "reputation")

	var minReputation float64
	if minRepStr := c.Query("min_reputation"); minRepStr != "" {
		parsed, err := strconv.ParseFloat(minRepStr, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid min_reputation value"})
			return
		}
		minReputation = parsed
	}

	agents, err := h.store.SearchAgentsAdvanced(c.Request.Context(), category, protocol, minReputation, sortParam)
	if err != nil {
		h.logger.Error("failed to search agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search agents"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  len(agents),
	})
}
