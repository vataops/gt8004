package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-analytics/internal/config"
	"github.com/GT8004/gt8004-analytics/internal/handler"
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

func NewRouter(cfg *config.Config, h *handler.Handler) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), securityHeaders(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	v1 := r.Group("/v1")

	// Dashboard
	v1.GET("/dashboard/overview", h.DashboardOverview)

	// Benchmark
	v1.GET("/benchmark", h.GetBenchmark)

	// Agent analytics (owner-authenticated)
	agentAuth := v1.Group("/agents/:agent_id")
	agentAuth.Use(OwnerAuthMiddleware(h.Store()))
	{
		agentAuth.GET("/analytics", h.AnalyticsReport)
		agentAuth.GET("/stats", h.AgentStats)
		agentAuth.GET("/stats/daily", h.AgentDailyStats)
		agentAuth.GET("/customers", h.ListCustomers)
		agentAuth.GET("/customers/:customer_id", h.GetCustomer)
		agentAuth.GET("/customers/:customer_id/logs", h.CustomerLogs)
		agentAuth.GET("/customers/:customer_id/tools", h.CustomerTools)
		agentAuth.GET("/customers/:customer_id/daily", h.CustomerDailyStats)
		agentAuth.GET("/revenue", h.RevenueReport)
		agentAuth.GET("/performance", h.PerformanceReport)
		agentAuth.GET("/logs", h.ListLogs)
		agentAuth.GET("/funnel", h.ConversionFunnel)
	}

	// Owner-level analytics (wallet-authenticated)
	walletAuth := v1.Group("/wallet/:address")
	walletAuth.Use(OwnerAuthMiddleware(h.Store()))
	{
		walletAuth.GET("/stats", h.WalletStats)
		walletAuth.GET("/daily", h.WalletDailyStats)
		walletAuth.GET("/errors", h.WalletErrors)
	}

	return r
}
