package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-ingest/internal/store"
)

const (
	ContextKeyAgentDBID = "agent_db_id"
	ContextKeyAgentID   = "agent_id"
)

// APIKeyAuth validates the Authorization: Bearer <key> header using SHA-256 hash lookup.
func APIKeyAuth(s *store.Store) gin.HandlerFunc {
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

		hash := sha256.Sum256([]byte(parts[1]))
		keyHash := hex.EncodeToString(hash[:])

		agentAuth, err := s.ValidateAPIKey(c.Request.Context(), keyHash)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
			return
		}

		c.Set(ContextKeyAgentDBID, agentAuth.AgentDBID)
		c.Set(ContextKeyAgentID, agentAuth.AgentID)
		c.Next()
	}
}
