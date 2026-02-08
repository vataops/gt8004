package server

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/AEL/ael-open/internal/handler"
)

const (
	// ContextKeyAgentDBID is the gin context key for the authenticated agent's DB UUID.
	ContextKeyAgentDBID = "agent_db_id"
	// ContextKeyAgentID is the gin context key for the authenticated agent's external ID.
	ContextKeyAgentID = "agent_id"
)

// APIKeyAuthMiddleware validates the API key from the Authorization header.
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
