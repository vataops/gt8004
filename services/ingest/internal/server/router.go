package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/GT8004/gt8004-ingest/internal/handler"
	"github.com/GT8004/gt8004-ingest/internal/middleware"
)

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
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

func NewRouter(h *handler.Handler) *gin.Engine {
	r := gin.New()
	r.Use(corsMiddleware(), gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	// SDK batch log ingestion (authenticated)
	r.POST("/v1/ingest", middleware.APIKeyAuth(h.Store()), h.IngestLogs)

	// Gateway proxy (public, rate-limited)
	r.Any("/gateway/:slug/*path", h.GatewayProxy)

	return r
}
