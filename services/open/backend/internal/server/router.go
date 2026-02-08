package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/AEL/ael-open/internal/config"
	"github.com/AEL/ael-open/internal/handler"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Customer-ID, X-Payment")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func NewRouter(_ *config.Config, h *handler.Handler, _ *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	// Gateway proxy (public, rate-limited)
	r.Any("/gateway/:slug/*path", h.GatewayProxy)

	v1 := r.Group("/v1")

	// Auth (no auth required)
	auth := v1.Group("/auth")
	{
		auth.POST("/challenge", h.AuthChallenge)
		auth.POST("/verify", h.AuthVerify)
	}

	// Agent registration (no auth required)
	v1.POST("/agents/register", h.RegisterAgent)

	// Agent search (public, no auth)
	v1.GET("/agents/search", h.SearchAgents)

	// Benchmark (public, no auth)
	v1.GET("/benchmark", h.GetBenchmark)

	// Dashboard (admin, no auth for MVP)
	dashboard := v1.Group("/dashboard")
	{
		dashboard.GET("/overview", h.DashboardOverview)
	}

	// API key authenticated routes
	authenticated := v1.Group("")
	authenticated.Use(APIKeyAuthMiddleware(h))
	{
		authenticated.GET("/agents/me", h.GetMe)
		authenticated.POST("/ingest", h.IngestLogs)
		authenticated.GET("/agents/:agent_id/stats", h.AgentStats)
		authenticated.GET("/agents/:agent_id/customers", h.ListCustomers)
		authenticated.GET("/agents/:agent_id/customers/:customer_id", h.GetCustomer)
		authenticated.GET("/agents/:agent_id/revenue", h.RevenueReport)
		authenticated.GET("/agents/:agent_id/performance", h.PerformanceReport)
		authenticated.GET("/agents/:agent_id/alerts", h.ListAlerts)
		authenticated.POST("/agents/:agent_id/alerts", h.CreateAlert)
		authenticated.PUT("/agents/:agent_id/alerts/:alert_id", h.UpdateAlert)
		authenticated.DELETE("/agents/:agent_id/alerts/:alert_id", h.DeleteAlert)
		authenticated.GET("/agents/:agent_id/alerts/history", h.AlertHistory)

		// Gateway management
		authenticated.POST("/agents/:agent_id/gateway/enable", h.EnableGateway)
		authenticated.POST("/agents/:agent_id/gateway/disable", h.DisableGateway)

		// Request logs
		authenticated.GET("/agents/:agent_id/logs", h.ListLogs)
	}

	return r
}
