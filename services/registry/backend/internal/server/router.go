package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/config"
	"github.com/GT8004/gt8004/internal/handler"
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
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Customer-ID, X-Wallet-Address")
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

func NewRouter(cfg *config.Config, h *handler.Handler, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), securityHeaders(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	// ERC-8004 agent descriptor
	r.GET("/.well-known/agent.json", h.AgentDescriptor)

	v1 := r.Group("/v1")

	// Auth (public, rate-limited)
	auth := v1.Group("/auth")
	auth.Use(RateLimitMiddleware(20, time.Minute))
	{
		auth.POST("/challenge", h.AuthChallenge)
		auth.POST("/verify", h.AuthVerify)
		auth.POST("/wallet-login", h.WalletLogin)
	}

	// ERC-8004 token verification (public)
	v1.GET("/erc8004/token/:token_id", h.VerifyToken)
	v1.GET("/erc8004/tokens/:address", h.ListTokensByOwner)

	// ERC-8004 Reputation Registry (public)
	v1.GET("/erc8004/reputation/:token_id/summary", h.GetReputationSummary)
	v1.GET("/erc8004/reputation/:token_id/feedbacks", h.GetReputationFeedbacks)

	// === Service Lifecycle ===
	v1.POST("/services/register", h.RegisterService)

	servicesAuth := v1.Group("/services")
	servicesAuth.Use(WalletOwnerAuthMiddleware(h))
	{
		servicesAuth.GET("/:agent_id", h.GetService)
		servicesAuth.PUT("/:agent_id/tier", h.UpdateTier)
		servicesAuth.PUT("/:agent_id/link-erc8004", h.LinkERC8004)
		servicesAuth.DELETE("/:agent_id", h.DeregisterService)
	}

	// === Agent Routes (backwards compatible) ===
	v1.POST("/agents/register", h.RegisterService)
	v1.GET("/agents/search", h.SearchAgents)
	v1.GET("/agents/wallet/:address", h.ListWalletAgents)

	// Agent reviews (public read, wallet-auth write)
	v1.GET("/agents/:agent_id/reviews", h.ListReviews)
	v1.POST("/agents/:agent_id/reviews", h.CreateReview)

	// Agent health (public)
	v1.GET("/agents/:agent_id/health", h.AgentHealth)
	v1.GET("/agents/:agent_id/origin-health", h.AgentOriginHealth)

	// Generic service health proxy (avoids browser CORS)
	v1.GET("/proxy/health", h.ServiceHealth)

	// API key authenticated routes (write operations)
	authenticated := v1.Group("")
	authenticated.Use(APIKeyAuthMiddleware(h))
	{
		authenticated.GET("/agents/me", h.GetMe)
	}

	// Owner-authenticated routes (API key or wallet address)
	ownerAuth := v1.Group("")
	ownerAuth.Use(WalletOwnerAuthMiddleware(h))
	{
		ownerAuth.GET("/agents/:agent_id/api-key", h.GetAPIKey)
		ownerAuth.POST("/agents/:agent_id/api-key/regenerate", h.RegenerateAPIKey)
	}

	// === Internal API (service-to-service, shared-secret auth) ===
	internal := r.Group("/internal")
	internal.Use(InternalAuthMiddleware(cfg.InternalSecret))
	{
		internal.GET("/agents/:slug", h.InternalGetAgent)
		internal.POST("/validate-key", h.InternalValidateKey)
		internal.PUT("/agents/:id/stats", h.InternalUpdateAgentStats)
		internal.PUT("/agents/:id/customers-count", h.InternalUpdateCustomersCount)
		internal.POST("/reconcile", h.InternalReconcile)
	}

	return r
}
