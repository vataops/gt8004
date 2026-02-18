package server

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// OwnerAuthMiddleware authenticates the request via API key or wallet address.
// Wallet address is only trusted when it matches a registered agent's EVM address.
func OwnerAuthMiddleware(s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1) Try API key (prefer X-Forwarded-Authorization from API Gateway)
		authHeader := c.GetHeader("X-Forwarded-Authorization")
		if authHeader == "" {
			authHeader = c.GetHeader("Authorization")
		}
		if authHeader != "" {
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

		// 2) Try wallet address — verify ownership of the requested agent
		walletAddr := c.GetHeader("X-Wallet-Address")
		if walletAddr != "" && strings.HasPrefix(walletAddr, "0x") && len(walletAddr) == 42 {
			// For agent endpoints, verify the wallet owns the agent
			if agentID := c.Param("agent_id"); agentID != "" {
				if dbID, evmAddr, err := s.GetAgentEVMAddress(c.Request.Context(), agentID); err == nil {
					if strings.EqualFold(evmAddr, walletAddr) {
						_ = dbID
						c.Set("auth_evm_address", strings.ToLower(walletAddr))
						c.Next()
						return
					}
				}
			} else {
				// For wallet endpoints (/wallet/:address/*), accept if header matches URL
				if urlAddr := c.Param("address"); urlAddr != "" && strings.EqualFold(urlAddr, walletAddr) {
					c.Set("auth_evm_address", strings.ToLower(walletAddr))
					c.Next()
					return
				}
			}
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
	}
}