package handler

import (
	"go.uber.org/zap"

	"github.com/AEL/ael-common/identity"
	"github.com/AEL/ael-common/ws"
	"github.com/AEL/ael-open/internal/analytics"
	"github.com/AEL/ael-open/internal/gateway"
	"github.com/AEL/ael-open/internal/ingest"
	"github.com/AEL/ael-open/internal/store"
)

// Handler holds dependencies for all HTTP handlers.
type Handler struct {
	store             *store.Store
	identity          *identity.Verifier
	hub               *ws.Hub
	worker            *ingest.Worker
	customerAnalytics *analytics.CustomerAnalytics
	revenueAnalytics  *analytics.RevenueAnalytics
	perfAnalytics     *analytics.PerformanceAnalytics
	proxy             *gateway.Proxy
	rateLimiter       *gateway.RateLimiter
	logger            *zap.Logger
}

func New(
	s *store.Store,
	id *identity.Verifier,
	hub *ws.Hub,
	worker *ingest.Worker,
	custAnalytics *analytics.CustomerAnalytics,
	revAnalytics *analytics.RevenueAnalytics,
	perfAnalytics *analytics.PerformanceAnalytics,
	proxy *gateway.Proxy,
	rateLimiter *gateway.RateLimiter,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		store:             s,
		identity:          id,
		hub:               hub,
		worker:            worker,
		customerAnalytics: custAnalytics,
		revenueAnalytics:  revAnalytics,
		perfAnalytics:     perfAnalytics,
		proxy:             proxy,
		rateLimiter:       rateLimiter,
		logger:            logger,
	}
}

// Store returns the underlying store (used by middleware).
func (h *Handler) Store() *store.Store {
	return h.store
}
