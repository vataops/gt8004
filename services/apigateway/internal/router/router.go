package router

import (
	"strings"

	"github.com/GT8004/apigateway/internal/config"
	"github.com/GT8004/apigateway/internal/middleware"
	"github.com/GT8004/apigateway/internal/proxy"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// analyticsSubPaths lists the sub-resource prefixes under /v1/agents/:id
// that belong to the Analytics service.
var analyticsSubPaths = map[string]bool{
	"stats":       true,
	"customers":   true,
	"revenue":     true,
	"performance": true,
	"logs":        true,
	"analytics":   true,
	"funnel":      true,
}

// Setup configures all routes for the API Gateway.
func Setup(r *gin.Engine, cfg *config.Config, logger *zap.Logger) {
	// Global middleware
	r.Use(middleware.RequestLogger(logger))
	r.Use(middleware.CORS())

	// Health check (served directly by the gateway)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "api-gateway"})
	})

	// ── Analytics ───────────────────────────────────
	r.Any("/v1/dashboard/*path", proxy.ProxyTo(cfg.AnalyticsURL, logger))
	r.Any("/v1/benchmark", proxy.ProxyTo(cfg.AnalyticsURL, logger))
	r.Any("/v1/wallet/:address/*action", proxy.ProxyTo(cfg.AnalyticsURL, logger))

	// Agent sub-resources: route to Analytics or Registry based on sub-path.
	// This avoids the Gin group conflict where /v1/agents/:id (Registry)
	// and /v1/agents/:id/stats (Analytics) can't coexist in separate groups.
	agentRouter := func(analyticsProxy, registryProxy gin.HandlerFunc) gin.HandlerFunc {
		return func(c *gin.Context) {
			rest := c.Param("rest")
			rest = strings.TrimLeft(rest, "/")
			firstSeg := strings.SplitN(rest, "/", 2)[0]
			if analyticsSubPaths[firstSeg] {
				analyticsProxy(c)
			} else {
				registryProxy(c)
			}
		}
	}

	analyticsHandler := proxy.ProxyTo(cfg.AnalyticsURL, logger)
	registryHandler := proxy.ProxyTo(cfg.RegistryURL, logger)

	// /v1/agents (list) must be explicit — Gin won't trigger NoRoute
	// when child routes like /v1/agents/:id exist in the tree.
	r.Any("/v1/agents", registryHandler)
	r.Any("/v1/agents/:id/*rest", agentRouter(analyticsHandler, registryHandler))
	r.Any("/v1/agents/:id", registryHandler)

	// ── Discovery ───────────────────────────────────
	r.Any("/v1/network/*path", proxy.ProxyTo(cfg.DiscoveryURL, logger))

	// ── Registry (default) ──────────────────────────
	// NoRoute catches all unmatched paths and proxies to Registry.
	r.NoRoute(proxy.ProxyTo(cfg.RegistryURL, logger))
}
