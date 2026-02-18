package server

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-discovery/internal/handler"
)

var allowedOrigins = map[string]bool{
	"https://gt8004.xyz":     true,
	"https://www.gt8004.xyz": true,
	"http://localhost:3000":   true,
	"http://localhost:8080":   true,
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowedOrigins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Next()
	}
}

// InternalAuthMiddleware validates the shared secret for service-to-service calls.
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

func NewRouter(h *handler.Handler, internalSecret string) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), securityHeaders(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	v1 := r.Group("/v1")

	// Network agents (public — all on-chain ERC-8004 agents)
	v1.GET("/network/agents", h.ListNetworkAgents)
	v1.GET("/network/agents/:chain_id/:token_id", h.GetNetworkAgent)
	v1.GET("/network/stats", h.GetNetworkStats)

	// Internal API (service-to-service, shared-secret auth)
	internal := r.Group("/internal")
	internal.Use(InternalAuthMiddleware(internalSecret))
	{
		internal.POST("/sync-token", h.InternalSyncToken)
	}

	return r
}
