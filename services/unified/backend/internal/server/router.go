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
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Customer-ID, X-Admin-Key")
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

	// Gateway proxy (public, rate-limited)
	r.Any("/gateway/:slug/*path", h.GatewayProxy)

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

	// Network agents (public — all on-chain ERC-8004 agents)
	v1.GET("/network/agents", h.ListNetworkAgents)
	v1.GET("/network/agents/:chain_id/:token_id", h.GetNetworkAgent)
	v1.GET("/network/stats", h.GetNetworkStats)

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

	// === Open Tier Routes (backwards compatible) ===
	// Agent registration (public) — uses unified RegisterService with ERC-8004 support
	v1.POST("/agents/register", h.RegisterService)
	v1.GET("/agents/search", h.SearchAgents)
	v1.GET("/agents/wallet/:address", h.ListWalletAgents)
	v1.GET("/benchmark", h.GetBenchmark)

	// Dashboard (public for MVP)
	dashboard := v1.Group("/dashboard")
	{
		dashboard.GET("/overview", h.DashboardOverview)
	}

	// Public agent analytics (read-only, resolved by agent_id slug)
	v1.GET("/agents/:agent_id/stats", h.AgentStats)
	v1.GET("/agents/:agent_id/stats/daily", h.AgentDailyStats)
	v1.GET("/agents/:agent_id/customers", h.ListCustomers)
	v1.GET("/agents/:agent_id/customers/:customer_id", h.GetCustomer)
	v1.GET("/agents/:agent_id/revenue", h.RevenueReport)
	v1.GET("/agents/:agent_id/performance", h.PerformanceReport)
	v1.GET("/agents/:agent_id/logs", h.ListLogs)

	// API key authenticated routes (write operations)
	authenticated := v1.Group("")
	authenticated.Use(APIKeyAuthMiddleware(h))
	{
		authenticated.GET("/agents/me", h.GetMe)
		authenticated.PUT("/agents/me/endpoint", h.UpdateOriginEndpoint)
		authenticated.POST("/ingest", h.IngestLogs)
		authenticated.POST("/agents/:agent_id/gateway/enable", h.EnableGateway)
		authenticated.POST("/agents/:agent_id/gateway/disable", h.DisableGateway)
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
