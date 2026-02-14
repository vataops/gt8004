package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-analytics/internal/config"
	"github.com/GT8004/gt8004-analytics/internal/handler"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Customer-ID")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func NewRouter(cfg *config.Config, h *handler.Handler) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	v1 := r.Group("/v1")

	// Dashboard
	v1.GET("/dashboard/overview", h.DashboardOverview)

	// Benchmark
	v1.GET("/benchmark", h.GetBenchmark)

	// Agent analytics (public, by slug)
	v1.GET("/agents/:agent_id/analytics", h.AnalyticsReport)
	v1.GET("/agents/:agent_id/stats", h.AgentStats)
	v1.GET("/agents/:agent_id/stats/daily", h.AgentDailyStats)
	v1.GET("/agents/:agent_id/customers", h.ListCustomers)
	v1.GET("/agents/:agent_id/customers/:customer_id", h.GetCustomer)
	v1.GET("/agents/:agent_id/customers/:customer_id/logs", h.CustomerLogs)
	v1.GET("/agents/:agent_id/customers/:customer_id/tools", h.CustomerTools)
	v1.GET("/agents/:agent_id/customers/:customer_id/daily", h.CustomerDailyStats)
	v1.GET("/agents/:agent_id/revenue", h.RevenueReport)
	v1.GET("/agents/:agent_id/performance", h.PerformanceReport)
	v1.GET("/agents/:agent_id/logs", h.ListLogs)
	v1.GET("/agents/:agent_id/funnel", h.ConversionFunnel)

	// Owner-level analytics (public, by wallet address)
	v1.GET("/wallet/:address/stats", h.WalletStats)
	v1.GET("/wallet/:address/daily", h.WalletDailyStats)
	v1.GET("/wallet/:address/errors", h.WalletErrors)

	return r
}
