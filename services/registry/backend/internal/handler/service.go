package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
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

// AgentMetadata represents the parsed agentURI JSON structure
type AgentMetadata struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Image       string              `json:"image"`
	Services    []AgentServiceEntry `json:"services"`
	Endpoints   []AgentServiceEntry `json:"endpoints"` // fallback field name
	URL         string              `json:"url"`       // fallback single URL
	Type        string              `json:"type"`      // e.g., "A2A", "MCP"
}

type AgentServiceEntry struct {
	Name     string `json:"name"`
	Endpoint string `json:"endpoint"`
}

type RegisterServiceRequest struct {
	// ERC-8004 fields - all metadata comes from contract
	// Backend verifies token ownership via RPC call
	ERC8004TokenID *int64 `json:"erc8004_token_id"`
	ChainID        *int   `json:"chain_id"`
	WalletAddress  string `json:"wallet_address" binding:"required"`

	// Service-level settings
	GatewayEnabled *bool  `json:"gateway_enabled"`
	Tier           string `json:"tier"`
	Pricing        *Pricing `json:"pricing"`
}

// parseAgentURI decodes and parses the agentURI into structured metadata.
// Supports: data:application/json;base64,{base64}, data:application/json,{json}, or plain JSON.
func parseAgentURI(uri string) (*AgentMetadata, error) {
	if uri == "" {
		return nil, fmt.Errorf("empty agentURI")
	}

	var jsonStr string
	if strings.HasPrefix(uri, "data:application/json;base64,") {
		encoded := strings.TrimPrefix(uri, "data:application/json;base64,")
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, fmt.Errorf("failed to decode base64: %w", err)
		}
		jsonStr = string(decoded)
	} else if strings.HasPrefix(uri, "data:application/json,") {
		jsonStr = strings.TrimPrefix(uri, "data:application/json,")
	} else if strings.HasPrefix(uri, "{") {
		jsonStr = uri
	} else {
		return nil, fmt.Errorf("unsupported agentURI format")
	}

	var meta AgentMetadata
	if err := json.Unmarshal([]byte(jsonStr), &meta); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return &meta, nil
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

	// Validate ERC-8004 registration
	if req.ERC8004TokenID == nil || req.ChainID == nil || req.WalletAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ERC-8004 registration requires erc8004_token_id, chain_id, and wallet_address"})
		return
	}

	tier := req.Tier
	if tier == "" {
		tier = "open"
	}
	if tier != "open" && tier != "lite" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier: must be open or lite"})
		return
	}

	gatewayEnabled := req.GatewayEnabled != nil && *req.GatewayEnabled

	// Resolve chain-specific client
	chainID := *req.ChainID
	if h.erc8004Registry == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ERC-8004 not configured"})
		return
	}

	erc8004Client, err := h.erc8004Registry.GetClient(chainID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify on-chain ownership via RPC call
	owner, err := erc8004Client.VerifyOwnership(c.Request.Context(), *req.ERC8004TokenID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token not found on-chain: " + err.Error()})
		return
	}
	if !strings.EqualFold(owner, req.WalletAddress) {
		c.JSON(http.StatusForbidden, gin.H{"error": "wallet does not own this token"})
		return
	}

	// Check for duplicate token ID (only active agents)
	existing, _ := h.store.GetAgentByTokenID(c.Request.Context(), *req.ERC8004TokenID)
	if existing != nil && existing.Status != "deregistered" {
		c.JSON(http.StatusConflict, gin.H{"error": "token already linked to another agent"})
		return
	}

	// Get agent URI from contract
	agentURI, err := erc8004Client.GetAgentURI(c.Request.Context(), *req.ERC8004TokenID)
	if err != nil || agentURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to fetch agentURI from contract"})
		return
	}

	// Parse agentURI to extract metadata
	meta, err := parseAgentURI(agentURI)
	if err != nil {
		h.logger.Warn("failed to parse agentURI, using defaults", zap.Error(err))
		meta = &AgentMetadata{
			Name: fmt.Sprintf("Token #%d", *req.ERC8004TokenID),
		}
	}

	// Generate agent_id: {chainId}-{sha256(tokenId)[:6]}
	hashInput := fmt.Sprintf("%d", *req.ERC8004TokenID)
	hash := sha256.Sum256([]byte(hashInput))
	agentID := fmt.Sprintf("%d-%s", chainID, hex.EncodeToString(hash[:])[:6])

	// Extract origin endpoint ONLY from on-chain metadata (no manual override)
	var originEndpoint string
	{
		svc := meta.Services
		if len(svc) == 0 {
			svc = meta.Endpoints
		}
		if len(svc) > 0 {
			originEndpoint = svc[0].Endpoint
		} else if meta.URL != "" {
			originEndpoint = meta.URL
		}
	}
	if gatewayEnabled && originEndpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "gateway mode requires a service endpoint in on-chain metadata"})
		return
	}

	// Extract protocols from metadata
	var protocols []string
	services := meta.Services
	if len(services) == 0 {
		services = meta.Endpoints
	}
	for _, svc := range services {
		if svc.Name != "" {
			protocols = append(protocols, svc.Name)
		}
	}
	if len(protocols) == 0 && meta.Type != "" {
		protocols = []string{meta.Type}
	}

	// Create agent with metadata from contract
	agent := &store.Agent{
		AgentID:        agentID,
		Name:           meta.Name,
		OriginEndpoint: originEndpoint,
		Protocols:      protocols,
		Category:       meta.Type, // Use Type as category
		GatewayEnabled: gatewayEnabled,
		Status:         "active",
		CurrentTier:    tier,
		ERC8004TokenID: req.ERC8004TokenID,
		ChainID:        chainID,
		AgentURI:       agentURI,
		EVMAddress:     req.WalletAddress,
		IdentityRegistry: erc8004Client.RegistryAddr(),
	}

	now := time.Now()
	agent.VerifiedAt = &now

	if req.Pricing != nil {
		agent.PricingModel = req.Pricing.Model
		agent.PricingCurrency = req.Pricing.Currency
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

	// Invalidate search/overview caches after new registration
	h.cache.DelPattern(c.Request.Context(), "search:*")
	h.cache.Del(c.Request.Context(), "overview")
	if agent.EVMAddress != "" {
		h.cache.Del(c.Request.Context(), fmt.Sprintf("wallet:%s", strings.ToLower(agent.EVMAddress)))
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

	if req.Tier != "open" && req.Tier != "lite" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier"})
		return
	}

	agent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	// Upgrade to lite requires verified EVM address
	if req.Tier == "lite" && agent.EVMAddress == "" {
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

type DeregisterRequest struct {
	Challenge string `json:"challenge"`
	Signature string `json:"signature"`
}

func (h *Handler) DeregisterService(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	// If using wallet auth (X-Wallet-Address), require signature verification
	walletAddr := c.GetHeader("X-Wallet-Address")
	if walletAddr != "" {
		var req DeregisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "challenge and signature required for wallet auth"})
			return
		}

		// Verify signature
		agentID := c.Param("agent_id")
		verifyReq := identity.VerifyRequest{
			AgentID:   agentID,
			Challenge: req.Challenge,
			Signature: req.Signature,
		}
		info, err := h.identity.VerifySignature(verifyReq)
		if err != nil {
			h.logger.Warn("signature verification failed", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}

		// Check that the signer matches the wallet address
		if !strings.EqualFold(info.EVMAddress, walletAddr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "signature does not match wallet address"})
			return
		}
	}

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
	if err := h.store.LinkERC8004(c.Request.Context(), dbID, req.ERC8004TokenID, chainID, agentURI, registryAddr, info.EVMAddress); err != nil {
		h.logger.Error("failed to link erc8004", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link ERC-8004"})
		return
	}

	// Invalidate wallet + search caches after ERC-8004 link
	h.cache.Del(c.Request.Context(), fmt.Sprintf("wallet:%s", strings.ToLower(info.EVMAddress)))
	h.cache.DelPattern(c.Request.Context(), "search:*")

	c.JSON(http.StatusOK, gin.H{
		"verified":         true,
		"evm_address":      info.EVMAddress,
		"erc8004_token_id": req.ERC8004TokenID,
		"agent_uri":        agentURI,
	})
}
