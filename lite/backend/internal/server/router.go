package server

import (
	"github.com/gin-gonic/gin"

	"github.com/AEL/aes-lite/internal/config"
	"github.com/AEL/aes-lite/internal/handler"
	"github.com/AEL/aes-lite/internal/x402"
	"go.uber.org/zap"
)

func NewRouter(cfg *config.Config, h *handler.Handler, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// Health
	r.GET("/healthz", h.Healthz)
	r.GET("/readyz", h.Readyz)

	v1 := r.Group("/v1")

	// x402 payment middleware (for routes that require payment)
	paymentRequired := x402.Middleware(cfg.X402FacilitatorURL, cfg.PaymentRecipient, logger)

	// Auth
	auth := v1.Group("/auth")
	{
		auth.POST("/challenge", h.AuthChallenge)
		auth.POST("/verify", h.AuthVerify)
	}

	// Channels (public API)
	channels := v1.Group("/channels")
	{
		channels.POST("", paymentRequired, h.CreateChannel)
		channels.GET("/:id", h.GetChannel)
		channels.POST("/:id/topup", paymentRequired, h.TopupChannel)
		channels.POST("/:id/close", h.CloseChannel)
		channels.POST("/:id/tx", h.CreateTransaction)
		channels.GET("/:id/ws", h.ChannelWebSocket)
	}

	// Admin API (dashboard)
	admin := v1.Group("/admin")
	admin.Use(adminAuthMiddleware(cfg.AdminAPIKey))
	{
		admin.GET("/overview", h.AdminOverview)
		admin.GET("/channels", h.AdminListChannels)
		admin.GET("/channels/:id", h.AdminGetChannel)
		admin.GET("/channels/:id/transactions", h.AdminChannelTransactions)
		admin.GET("/agents", h.AdminListAgents)
		admin.GET("/agents/:id", h.AdminGetAgent)
		admin.GET("/escrow", h.AdminEscrow)
		admin.GET("/events", h.AdminListEvents)
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
