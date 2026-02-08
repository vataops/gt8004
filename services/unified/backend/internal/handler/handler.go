package handler

import (
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-common/identity"
	"github.com/GT8004/gt8004-common/ws"
	"github.com/GT8004/gt8004/internal/analytics"
	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/gateway"
	"github.com/GT8004/gt8004/internal/ingest"
	"github.com/GT8004/gt8004/internal/store"
)

type Handler struct {
	// Shared
	store    *store.Store
	identity *identity.Verifier
	hub      *ws.Hub
	logger   *zap.Logger

	// Open features
	worker            *ingest.Worker
	customerAnalytics *analytics.CustomerAnalytics
	revenueAnalytics  *analytics.RevenueAnalytics
	perfAnalytics     *analytics.PerformanceAnalytics
	proxy             *gateway.Proxy
	rateLimiter       *gateway.RateLimiter

	// ERC-8004
	erc8004Registry *erc8004.Registry
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
	erc8004Registry *erc8004.Registry,
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
		erc8004Registry:   erc8004Registry,
		logger:            logger,
	}
}

func (h *Handler) Store() *store.Store {
	return h.store
}
