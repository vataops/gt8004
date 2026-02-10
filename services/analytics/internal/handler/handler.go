package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/analytics"
	"github.com/GT8004/gt8004-analytics/internal/cache"
	"github.com/GT8004/gt8004-analytics/internal/ingest"
	"github.com/GT8004/gt8004-analytics/internal/store"
)

type Handler struct {
	store             *store.Store
	cache             *cache.Cache
	logger            *zap.Logger
	worker            *ingest.Worker
	customerAnalytics *analytics.CustomerAnalytics
	revenueAnalytics  *analytics.RevenueAnalytics
	perfAnalytics     *analytics.PerformanceAnalytics
}

func New(
	s *store.Store,
	worker *ingest.Worker,
	custAnalytics *analytics.CustomerAnalytics,
	revAnalytics *analytics.RevenueAnalytics,
	perfAnalytics *analytics.PerformanceAnalytics,
	redisCache *cache.Cache,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		store:             s,
		cache:             redisCache,
		worker:            worker,
		customerAnalytics: custAnalytics,
		revenueAnalytics:  revAnalytics,
		perfAnalytics:     perfAnalytics,
		logger:            logger,
	}
}

func (h *Handler) Store() *store.Store {
	return h.store
}

// resolvePublicAgent resolves an agent by its slug (agent_id) from URL params.
// Used for public read-only endpoints that don't require authentication.
func (h *Handler) resolvePublicAgent(c *gin.Context) (uuid.UUID, bool) {
	slug := c.Param("agent_id")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id required"})
		return uuid.UUID{}, false
	}
	agent, err := h.store.GetAgentByID(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return uuid.UUID{}, false
	}
	return agent.ID, true
}
