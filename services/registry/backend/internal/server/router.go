package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/config"
	"github.com/GT8004/gt8004/internal/handler"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Customer-ID, X-Admin-Key, X-Wallet-Address")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func NewRouter(cfg *config.Config, h *handler.Handler, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	// ERC-8004 agent descriptor
	r.GET("/.well-known/agent.json", h.AgentDescriptor)

	v1 := r.Group("/v1")

	// Auth (public)
	auth := v1.Group("/auth")
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
	servicesAuth.Use(APIKeyAuthMiddleware(h))
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

	// Agent health (public)
	v1.GET("/agents/:agent_id/health", h.AgentHealth)
	v1.GET("/agents/:agent_id/origin-health", h.AgentOriginHealth)

	// API key authenticated routes (write operations)
	authenticated := v1.Group("")
	authenticated.Use(APIKeyAuthMiddleware(h))
	{
		authenticated.GET("/agents/me", h.GetMe)
		authenticated.PUT("/agents/me/endpoint", h.UpdateOriginEndpoint)
	}

	// Owner-authenticated routes (API key or wallet address)
	ownerAuth := v1.Group("")
	ownerAuth.Use(WalletOwnerAuthMiddleware(h))
	{
		ownerAuth.PUT("/agents/:agent_id/endpoint", h.UpdateAgentEndpoint)
		ownerAuth.POST("/agents/:agent_id/gateway/enable", h.EnableGateway)
		ownerAuth.POST("/agents/:agent_id/gateway/disable", h.DisableGateway)
		ownerAuth.POST("/agents/:agent_id/api-key/regenerate", h.RegenerateAPIKey)
	}

	// === Admin API ===
	admin := v1.Group("/admin")
	admin.Use(adminAuthMiddleware(cfg.AdminAPIKey))
	{
		admin.GET("/overview", h.AdminOverview)
		admin.GET("/agents", h.AdminListAgents)
		admin.GET("/agents/:id", h.AdminGetAgent)
		admin.GET("/events/ws", h.AdminEventsWebSocket)
	}

	// === Internal API (service-to-service) ===
	internal := r.Group("/internal")
	{
		internal.GET("/agents/:slug", h.InternalGetAgent)
		internal.POST("/validate-key", h.InternalValidateKey)
		internal.PUT("/agents/:id/stats", h.InternalUpdateAgentStats)
		internal.PUT("/agents/:id/customers-count", h.InternalUpdateCustomersCount)
	}

	return r
}

func adminAuthMiddleware(apiKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if apiKey == "" {
			c.Next()
			return
		}
		key := c.GetHeader("X-Admin-Key")
		if key != apiKey {
			c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}
