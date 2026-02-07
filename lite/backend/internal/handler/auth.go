package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/identity"
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

	// Persist verified EVM address to DB for settlement
	if info.EVMAddress != "" {
		if err := h.store.UpdateAgentEVMAddress(c.Request.Context(), req.AgentID, info.EVMAddress); err != nil {
			h.logger.Warn("failed to save agent EVM address", zap.Error(err))
		}
	}

	c.JSON(http.StatusOK, info)
}
