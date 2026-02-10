package handler

import (
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-gateway/internal/client"
	"github.com/GT8004/gt8004-gateway/internal/proxy"
)

type Handler struct {
	registry    *client.RegistryClient
	analytics   *client.AnalyticsClient
	proxy       *proxy.Proxy
	rateLimiter *proxy.RateLimiter
	logger      *zap.Logger
}

func New(
	registry *client.RegistryClient,
	analytics *client.AnalyticsClient,
	p *proxy.Proxy,
	rateLimiter *proxy.RateLimiter,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		registry:    registry,
		analytics:   analytics,
		proxy:       p,
		rateLimiter: rateLimiter,
		logger:      logger,
	}
}
