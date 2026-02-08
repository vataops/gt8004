package server

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/GT8004/gt8004/internal/handler"
)

const (
	ContextKeyAgentDBID = "agent_db_id"
	ContextKeyAgentID   = "agent_id"
)

func APIKeyAuthMiddleware(h *handler.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		rawKey := parts[1]
		hash := sha256.Sum256([]byte(rawKey))
		keyHash := hex.EncodeToString(hash[:])

		agentAuth, err := h.Store().ValidateAPIKey(c.Request.Context(), keyHash)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
			return
		}

		c.Set(ContextKeyAgentDBID, agentAuth.AgentDBID)
		c.Set(ContextKeyAgentID, agentAuth.AgentID)
		c.Next()
	}
}

// TierRequiredMiddleware checks that the authenticated agent has at least the required tier.
func TierRequiredMiddleware(requiredTier string, h *handler.Handler) gin.HandlerFunc {
	tierLevels := map[string]int{"open": 1, "lite": 2, "pro": 3}

	return func(c *gin.Context) {
		agentDBID, exists := c.Get(ContextKeyAgentDBID)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		dbID, ok := agentDBID.(uuid.UUID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
			return
		}

		agent, err := h.Store().GetAgentByDBID(c.Request.Context(), dbID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "agent lookup failed"})
			return
		}

		currentLevel := tierLevels[agent.CurrentTier]
		requiredLevel := tierLevels[requiredTier]

		if currentLevel < requiredLevel {
			agentID, _ := c.Get(ContextKeyAgentID)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":         "tier_required",
				"current_tier":  agent.CurrentTier,
				"required_tier": requiredTier,
				"upgrade_url":   fmt.Sprintf("/v1/services/%s/tier", agentID),
			})
			return
		}

		c.Next()
	}
}
