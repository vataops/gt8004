package server

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-analytics/internal/config"
	"github.com/GT8004/gt8004-analytics/internal/handler"
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
	// Authenticated ingest (API key auth via middleware)
	authenticated := v1.Group("")
	authenticated.Use(APIKeyAuthMiddleware(h))
	authenticated.POST("/ingest", h.IngestLogs)

	// Internal API (Gateway -> Analytics)
	internal := r.Group("/internal")
	internal.POST("/ingest", h.InternalIngest)

	// Admin
	admin := v1.Group("/admin")
	admin.Use(adminAuthMiddleware(cfg.AdminAPIKey))
	admin.GET("/overview", h.AdminOverview)

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

// APIKeyAuthMiddleware validates a Bearer token by SHA-256 hashing and looking up in the shared DB.
func APIKeyAuthMiddleware(h *handler.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
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

		c.Set("agent_db_id", agentAuth.AgentDBID)
		c.Set("agent_id", agentAuth.AgentID)
		c.Next()
	}
}
