package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// GetAPIKey returns the current active API key for the agent.
func (h *Handler) GetAPIKey(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	rawKey, err := h.store.GetActiveAPIKey(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get api key", zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "no active api key found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"api_key": rawKey})
}

// RegenerateAPIKey revokes all existing keys and issues a new one.
func (h *Handler) RegenerateAPIKey(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	// Revoke existing keys
	if err := h.store.RevokeAPIKeys(c.Request.Context(), dbID); err != nil {
		h.logger.Error("failed to revoke api keys", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke existing keys"})
		return
	}

	// Create new key
	rawKey, err := h.store.CreateAPIKey(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to create api key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate api key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"api_key": rawKey})
}
