package server

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// OwnerAuthMiddleware authenticates the request via API key or wallet address,
// then sets the authenticated EVM address in context for downstream ownership checks.
func OwnerAuthMiddleware(s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1) Try API key (Authorization: Bearer <key>)
		if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				hash := sha256.Sum256([]byte(parts[1]))
				keyHash := hex.EncodeToString(hash[:])
				if agentAuth, err := s.ValidateAPIKey(c.Request.Context(), keyHash); err == nil {
					// Look up the agent's EVM address for ownership verification
					if agent, err := s.GetAgentByDBID(c.Request.Context(), agentAuth.AgentDBID); err == nil {
						c.Set("auth_evm_address", agent.EVMAddress)
					}
					c.Next()
					return
				}
			}
		}

		// 2) Try wallet address (X-Wallet-Address header)
		walletAddr := c.GetHeader("X-Wallet-Address")
		if walletAddr != "" {
			c.Set("auth_evm_address", walletAddr)
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
	}
}