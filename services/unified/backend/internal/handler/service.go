package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-common/identity"
	"github.com/GT8004/gt8004/internal/store"
)

type RegisterServiceRequest struct {
	Name           string   `json:"name"`
	OriginEndpoint string   `json:"origin_endpoint" binding:"required"`
	Protocols      []string `json:"protocols"`
	Category       string   `json:"category"`
	Pricing        *Pricing `json:"pricing"`
	Tier           string   `json:"tier"`

	// ERC-8004 (optional)
	ERC8004TokenID *int64 `json:"erc8004_token_id"`
	ChainID        *int   `json:"chain_id"`
	WalletAddress  string `json:"wallet_address"`
	Challenge      string `json:"challenge"`
	Signature      string `json:"signature"`
}

type RegisterServiceResponse struct {
	AgentID        string `json:"agent_id"`
	GT8004Endpoint string `json:"gt8004_endpoint"`
	DashboardURL   string `json:"dashboard_url"`
	APIKey         string `json:"api_key"`
	Tier           string `json:"tier"`
	Status         string `json:"status"`
}

func (h *Handler) RegisterService(c *gin.Context) {
	var req RegisterServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Always auto-generate a unique agent_id (used as gateway endpoint + SDK tenant key)
	agentID := strings.ReplaceAll(uuid.New().String(), "-", "")[:12]

	tier := req.Tier
	if tier == "" {
		tier = "open"
	}
	if tier != "open" && tier != "lite" && tier != "pro" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier: must be open, lite, or pro"})
		return
	}

	agent := &store.Agent{
		AgentID:        agentID,
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

	// ERC-8004 on-chain verification (optional)
	if req.ERC8004TokenID != nil && req.Challenge != "" && req.Signature != "" {
		// Use wallet_address for challenge verification (challenge was created with wallet address)
		verifyID := req.WalletAddress
		if verifyID == "" {
			verifyID = agentID
		}
		verifyReq := identity.VerifyRequest{
			AgentID:   verifyID,
			Challenge: req.Challenge,
			Signature: req.Signature,
		}
		info, err := h.identity.VerifySignature(verifyReq)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "signature verification failed: " + err.Error()})
			return
		}

		// Resolve chain-specific client
		chainID := defaultChainID
		if req.ChainID != nil {
			chainID = *req.ChainID
		}

		if h.erc8004Registry != nil {
			erc8004Client, err := h.erc8004Registry.GetClient(chainID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Verify on-chain ownership
			owner, err := erc8004Client.VerifyOwnership(c.Request.Context(), *req.ERC8004TokenID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "token not found on-chain: " + err.Error()})
				return
			}
			if !strings.EqualFold(owner, info.EVMAddress) {
				c.JSON(http.StatusForbidden, gin.H{"error": "wallet does not own this token"})
				return
			}

			// Check for duplicate token ID
			existing, _ := h.store.GetAgentByTokenID(c.Request.Context(), *req.ERC8004TokenID)
			if existing != nil {
				c.JSON(http.StatusConflict, gin.H{"error": "token already linked to another agent"})
				return
			}

			// Get agent URI from contract
			agentURI, _ := erc8004Client.GetAgentURI(c.Request.Context(), *req.ERC8004TokenID)

			agent.ERC8004TokenID = req.ERC8004TokenID
			agent.AgentURI = agentURI
			agent.EVMAddress = info.EVMAddress
			agent.IdentityRegistry = erc8004Client.RegistryAddr()
			now := time.Now()
			agent.VerifiedAt = &now
		}
	}

	agent.GT8004Endpoint = fmt.Sprintf("/v1/agents/%s", agentID)

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
		AgentID:        agentID,
		GT8004Endpoint: agent.GT8004Endpoint,
		DashboardURL:   fmt.Sprintf("/dashboard/agents/%s", agentID),
		APIKey:         rawKey,
		Tier:           tier,
		Status:         "active",
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

// --- ERC-8004 link endpoint ---

type LinkERC8004Request struct {
	ERC8004TokenID int64  `json:"erc8004_token_id" binding:"required"`
	ChainID        *int   `json:"chain_id"`
	Challenge      string `json:"challenge" binding:"required"`
	Signature      string `json:"signature" binding:"required"`
}

func (h *Handler) LinkERC8004(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	var req LinkERC8004Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check duplicate token ID
	existing, _ := h.store.GetAgentByTokenID(c.Request.Context(), req.ERC8004TokenID)
	if existing != nil && existing.ID != dbID {
		c.JSON(http.StatusConflict, gin.H{"error": "token already linked to another agent"})
		return
	}

	// Verify signature
	verifyReq := identity.VerifyRequest{
		AgentID:   c.Param("agent_id"),
		Challenge: req.Challenge,
		Signature: req.Signature,
	}
	info, err := h.identity.VerifySignature(verifyReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "signature verification failed: " + err.Error()})
		return
	}

	// Resolve chain-specific client
	chainID := defaultChainID
	if req.ChainID != nil {
		chainID = *req.ChainID
	}

	agentURI := ""
	registryAddr := ""

	if h.erc8004Registry != nil {
		erc8004Client, err := h.erc8004Registry.GetClient(chainID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Verify on-chain ownership
		owner, err := erc8004Client.VerifyOwnership(c.Request.Context(), req.ERC8004TokenID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "token not found on-chain: " + err.Error()})
			return
		}
		if !strings.EqualFold(owner, info.EVMAddress) {
			c.JSON(http.StatusForbidden, gin.H{"error": "wallet does not own this token"})
			return
		}

		agentURI, _ = erc8004Client.GetAgentURI(c.Request.Context(), req.ERC8004TokenID)
		registryAddr = erc8004Client.RegistryAddr()
	}

	// Link in DB
	if err := h.store.LinkERC8004(c.Request.Context(), dbID, req.ERC8004TokenID, agentURI, registryAddr, info.EVMAddress); err != nil {
		h.logger.Error("failed to link erc8004", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link ERC-8004"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"verified":         true,
		"evm_address":      info.EVMAddress,
		"erc8004_token_id": req.ERC8004TokenID,
		"agent_uri":        agentURI,
	})
}
