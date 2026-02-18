package server

import (
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

func NewRouter(h *handler.Handler) *gin.Engine {
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

	return r
}
