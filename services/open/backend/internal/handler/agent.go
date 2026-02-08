package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/AEL/aes-open/internal/store"
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
	AESEndpoint  string `json:"aes_endpoint"`
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

	aesEndpoint := fmt.Sprintf("/v1/agents/%s", req.AgentID)
	agent.AESEndpoint = aesEndpoint

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
		AESEndpoint:  aesEndpoint,
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
