package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-common/identity"
)

func (h *Handler) AuthChallenge(c *gin.Context) {
	var req identity.ChallengeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.identity.CreateChallenge(req.AgentID)
	if err != nil {
		h.logger.Error("failed to create challenge", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create challenge"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AuthVerify(c *gin.Context) {
	var req identity.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	info, err := h.identity.VerifySignature(req)
	if err != nil {
		h.logger.Warn("auth verification failed", zap.Error(err), zap.String("agent", req.AgentID))
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Persist verified EVM address to DB
	if info.EVMAddress != "" {
		if err := h.store.SaveAgentEVMAddress(c.Request.Context(), req.AgentID, info.EVMAddress); err != nil {
			h.logger.Warn("failed to save agent EVM address", zap.Error(err))
		}
	}

	c.JSON(http.StatusOK, info)
}

// WalletLogin authenticates via wallet signature and returns an API key for
// the agent linked to that wallet address.
func (h *Handler) WalletLogin(c *gin.Context) {
	var req struct {
		Address   string `json:"address" binding:"required"`
		Challenge string `json:"challenge" binding:"required"`
		Signature string `json:"signature" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify wallet signature (address is used as agent_id in the identity system)
	info, err := h.identity.VerifySignature(identity.VerifyRequest{
		AgentID:   req.Address,
		Challenge: req.Challenge,
		Signature: req.Signature,
	})
	if err != nil {
		h.logger.Warn("wallet login verification failed", zap.Error(err), zap.String("address", req.Address))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "signature verification failed"})
		return
	}

	// Look up agents linked to this EVM address
	agents, err := h.store.GetAgentsByEVMAddress(c.Request.Context(), info.EVMAddress)
	if err != nil {
		h.logger.Error("failed to query agents by evm address", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if len(agents) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no agent registered with this wallet"})
		return
	}

	// Use the first agent (most common case: 1 wallet = 1 agent)
	agent := agents[0]

	// Issue a new API key
	apiKey, err := h.store.CreateAPIKey(c.Request.Context(), agent.ID)
	if err != nil {
		h.logger.Error("failed to create api key for wallet login", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue api key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent":   agent,
		"api_key": apiKey,
	})
}
