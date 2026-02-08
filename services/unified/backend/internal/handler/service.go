package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/store"
)

type RegisterServiceRequest struct {
	AgentID        string      `json:"agent_id" binding:"required"`
	Name           string      `json:"name"`
	OriginEndpoint string      `json:"origin_endpoint" binding:"required"`
	Protocols      []string    `json:"protocols"`
	Category       string      `json:"category"`
	Pricing        *Pricing    `json:"pricing"`
	Tier           string      `json:"tier"`
	ERC8004        *ERC8004Info `json:"erc8004"`
}

type ERC8004Info struct {
	TokenID  int64  `json:"token_id"`
	Registry string `json:"registry"`
}

type RegisterServiceResponse struct {
	AgentID      string `json:"agent_id"`
	GT8004Endpoint  string `json:"gt8004_endpoint"`
	DashboardURL string `json:"dashboard_url"`
	APIKey       string `json:"api_key"`
	Tier         string `json:"tier"`
	Status       string `json:"status"`
}

func (h *Handler) RegisterService(c *gin.Context) {
	var req RegisterServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tier := req.Tier
	if tier == "" {
		tier = "open"
	}
	if tier != "open" && tier != "lite" && tier != "pro" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier: must be open, lite, or pro"})
		return
	}

	agent := &store.Agent{
		AgentID:        req.AgentID,
		Name:           req.Name,
		OriginEndpoint: req.OriginEndpoint,
		Protocols:      req.Protocols,
		Category:       req.Category,
		Status:         "active",
		CurrentTier:    tier,
	}
	if req.Pricing != nil {
		agent.PricingModel = req.Pricing.Model
		agent.PricingCurrency = req.Pricing.Currency
	}
	if req.ERC8004 != nil {
		agent.ERC8004TokenID = &req.ERC8004.TokenID
		agent.IdentityRegistry = req.ERC8004.Registry
	}

	agent.GT8004Endpoint = fmt.Sprintf("/v1/agents/%s", req.AgentID)

	if err := h.store.CreateAgent(c.Request.Context(), agent); err != nil {
		h.logger.Error("failed to create agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register service"})
		return
	}

	rawKey, err := h.store.CreateAPIKey(c.Request.Context(), agent.ID)
	if err != nil {
		h.logger.Error("failed to create api key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate api key"})
		return
	}

	c.JSON(http.StatusCreated, RegisterServiceResponse{
		AgentID:      req.AgentID,
		GT8004Endpoint:  agent.GT8004Endpoint,
		DashboardURL: fmt.Sprintf("/dashboard/agents/%s", req.AgentID),
		APIKey:       rawKey,
		Tier:         tier,
		Status:       "active",
	})
}

func (h *Handler) GetService(c *gin.Context) {
	agentID := c.Param("agent_id")
	agent, err := h.store.GetAgentByID(c.Request.Context(), agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	resp := gin.H{
		"agent_id":    agent.AgentID,
		"name":        agent.Name,
		"tier":        agent.CurrentTier,
		"status":      agent.Status,
		"evm_address": agent.EVMAddress,
		"created_at":  agent.CreatedAt,
		"open": gin.H{
			"total_requests":     agent.TotalRequests,
			"total_revenue_usdc": agent.TotalRevenueUSDC,
			"gateway_enabled":    agent.GatewayEnabled,
			"reputation_score":   agent.ReputationScore,
		},
	}

	if agent.ERC8004TokenID != nil {
		resp["erc8004"] = gin.H{
			"token_id": *agent.ERC8004TokenID,
			"verified": agent.VerifiedAt != nil,
		}
	}

	c.JSON(http.StatusOK, resp)
}

type UpdateTierRequest struct {
	Tier       string `json:"tier" binding:"required"`
	EVMAddress string `json:"evm_address"`
}

func (h *Handler) UpdateTier(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	var req UpdateTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Tier != "open" && req.Tier != "lite" && req.Tier != "pro" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier"})
		return
	}

	agent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	// Upgrade to lite/pro requires verified EVM address
	if (req.Tier == "lite" || req.Tier == "pro") && agent.EVMAddress == "" {
		if req.EVMAddress == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "EVM address required for tier upgrade. Complete auth/verify first or provide evm_address.",
			})
			return
		}
		if err := h.store.SaveAgentEVMAddress(c.Request.Context(), agent.AgentID, req.EVMAddress); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save EVM address"})
			return
		}
	}

	if err := h.store.UpdateTier(c.Request.Context(), dbID, req.Tier); err != nil {
		h.logger.Error("failed to update tier", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update tier"})
		return
	}

	now := time.Now()
	c.JSON(http.StatusOK, gin.H{
		"agent_id":        agent.AgentID,
		"tier":            req.Tier,
		"tier_updated_at": now,
	})
}

func (h *Handler) DeregisterService(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	if err := h.store.DeregisterAgent(c.Request.Context(), dbID); err != nil {
		h.logger.Error("failed to deregister agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to deregister"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deregistered"})
}
