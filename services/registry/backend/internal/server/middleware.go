package server

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/handler"
)

const (
	ContextKeyAgentDBID = "agent_db_id"
	ContextKeyAgentID   = "agent_id"
)

func APIKeyAuthMiddleware(h *handler.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prefer X-Forwarded-Authorization (set by the API Gateway before
		// overwriting Authorization with the GCP identity token).
		authHeader := c.GetHeader("X-Forwarded-Authorization")
		if authHeader == "" {
			authHeader = c.GetHeader("Authorization")
		}
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

// WalletOwnerAuthMiddleware authenticates via API key or wallet address.
// Wallet owners are treated as root owners of their agents.
func WalletOwnerAuthMiddleware(h *handler.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		h.Logger().Debug("WalletOwnerAuth - Request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Bool("has_auth", c.GetHeader("Authorization") != ""),
			zap.String("X-Wallet-Address", c.GetHeader("X-Wallet-Address")),
			zap.String("agent_id_param", c.Param("agent_id")))

		// 1) Try API key (prefer forwarded header from API Gateway)
		authHeader := c.GetHeader("X-Forwarded-Authorization")
		if authHeader == "" {
			authHeader = c.GetHeader("Authorization")
		}
		if authHeader != "" {
			h.Logger().Info("WalletOwnerAuth - Trying API key auth")
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				hash := sha256.Sum256([]byte(parts[1]))
				keyHash := hex.EncodeToString(hash[:])
				if agentAuth, err := h.Store().ValidateAPIKey(c.Request.Context(), keyHash); err == nil {
					// If the route has an :agent_id param, the API key must belong to that agent.
					// This prevents any agent from accessing or modifying another agent's resources.
					if paramAgentID := c.Param("agent_id"); paramAgentID != "" && agentAuth.AgentID != paramAgentID {
						h.Logger().Warn("WalletOwnerAuth - API key does not belong to requested agent",
							zap.String("key_agent", agentAuth.AgentID),
							zap.String("requested_agent", paramAgentID))
						c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "api key does not belong to this agent"})
						return
					}
					h.Logger().Info("WalletOwnerAuth - API key auth SUCCESS")
					c.Set(ContextKeyAgentDBID, agentAuth.AgentDBID)
					c.Set(ContextKeyAgentID, agentAuth.AgentID)
					c.Next()
					return
				} else {
					h.Logger().Warn("WalletOwnerAuth - API key validation failed", zap.Error(err))
				}
			}
		}

		// 2) Try wallet address — verify the agent belongs to this wallet
		walletAddr := c.GetHeader("X-Wallet-Address")
		agentID := c.Param("agent_id")
		h.Logger().Info("WalletOwnerAuth - Trying wallet auth",
			zap.String("wallet", walletAddr),
			zap.String("agentID", agentID))
		if walletAddr != "" && agentID != "" {
			agent, err := h.Store().GetAgentByID(c.Request.Context(), agentID)
			if err != nil {
				h.Logger().Info("Agent not found", zap.Error(err))
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "agent not found"})
				return
			}
			h.Logger().Info("Checking wallet ownership",
				zap.String("agent_evm", agent.EVMAddress),
				zap.String("wallet", walletAddr))
			if !strings.EqualFold(agent.EVMAddress, walletAddr) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "wallet does not own this agent"})
				return
			}
			c.Set(ContextKeyAgentDBID, agent.ID)
			c.Set(ContextKeyAgentID, agent.AgentID)
			c.Next()
			return
		}

		h.Logger().Warn("Authorization required - no valid auth provided")
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
	}
}

// InternalAuthMiddleware validates the shared secret for service-to-service calls.
// The secret is required — if empty, all internal requests are rejected.
func InternalAuthMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "internal auth not configured"})
			return
		}
		token := c.GetHeader("X-Internal-Secret")
		if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(secret)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// ipRateLimiter tracks request counts per IP within a sliding window.
type ipRateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	rl := &ipRateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *ipRateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Remove expired entries
	reqs := rl.requests[ip]
	valid := reqs[:0]
	for _, t := range reqs {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.requests[ip] = valid
		return false
	}
	rl.requests[ip] = append(valid, now)
	return true
}

func (rl *ipRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for ip, reqs := range rl.requests {
			valid := reqs[:0]
			for _, t := range reqs {
				if t.After(cutoff) {
					valid = append(valid, t)
				}
			}
			if len(valid) == 0 {
				delete(rl.requests, ip)
			} else {
				rl.requests[ip] = valid
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware limits requests per IP address.
// limit: max requests, window: time window.
func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	limiter := newIPRateLimiter(limit, window)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}

// TierRequiredMiddleware checks that the authenticated agent has at least the required tier.
func TierRequiredMiddleware(requiredTier string, h *handler.Handler) gin.HandlerFunc {
	tierLevels := map[string]int{"open": 1, "lite": 2}

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
