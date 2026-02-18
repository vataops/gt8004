package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-ingest/internal/handler"
	"github.com/GT8004/gt8004-ingest/internal/middleware"
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
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Agent-ID, X-Payment")
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
		c.Next()
	}
}

func NewRouter(h *handler.Handler) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), securityHeaders(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	// SDK batch log ingestion (authenticated)
	r.POST("/v1/ingest", middleware.APIKeyAuth(h.Store()), h.IngestLogs)

	return r
}
