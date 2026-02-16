package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/analytics"
	"github.com/GT8004/gt8004-analytics/internal/cache"
	"github.com/GT8004/gt8004-analytics/internal/store"
)

type Handler struct {
	store             *store.Store
	cache             *cache.Cache
	logger            *zap.Logger
	customerAnalytics *analytics.CustomerAnalytics
	revenueAnalytics  *analytics.RevenueAnalytics
	perfAnalytics     *analytics.PerformanceAnalytics
	registryURL       string
}

func New(
	s *store.Store,
	custAnalytics *analytics.CustomerAnalytics,
	revAnalytics *analytics.RevenueAnalytics,
	perfAnalytics *analytics.PerformanceAnalytics,
	redisCache *cache.Cache,
	logger *zap.Logger,
	registryURL string,
) *Handler {
	return &Handler{
		store:             s,
		cache:             redisCache,
		customerAnalytics: custAnalytics,
		revenueAnalytics:  revAnalytics,
		perfAnalytics:     perfAnalytics,
		logger:            logger,
		registryURL:       registryURL,
	}
}

func (h *Handler) Store() *store.Store {
	return h.store
}

// resolveOwnedAgent resolves an agent by slug and verifies the authenticated
// user owns it (matching EVM address set by OwnerAuthMiddleware).
func (h *Handler) resolveOwnedAgent(c *gin.Context) (uuid.UUID, bool) {
	slug := c.Param("agent_id")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id required"})
		return uuid.UUID{}, false
	}

	dbID, evmAddr, err := h.store.GetAgentEVMAddress(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return uuid.UUID{}, false
	}

	// Check ownership against authenticated EVM address
	authEVM, _ := c.Get("auth_evm_address")
	authAddr, _ := authEVM.(string)
	if authAddr == "" || !strings.EqualFold(authAddr, evmAddr) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return uuid.UUID{}, false
	}

	return dbID, true
}
