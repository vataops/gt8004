package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-common/identity"
	"github.com/GT8004/gt8004-common/ws"
	"github.com/GT8004/gt8004/internal/cache"
	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/store"
)

type Handler struct {
	store    *store.Store
	identity *identity.Verifier
	hub      *ws.Hub
	cache    *cache.Cache
	logger   *zap.Logger

	// ERC-8004
	erc8004Registry *erc8004.Registry
}

func New(
	s *store.Store,
	id *identity.Verifier,
	hub *ws.Hub,
	erc8004Registry *erc8004.Registry,
	redisCache *cache.Cache,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		store:           s,
		identity:        id,
		hub:             hub,
		cache:           redisCache,
		erc8004Registry: erc8004Registry,
		logger:          logger,
	}
}

func (h *Handler) Store() *store.Store {
	return h.store
}

func (h *Handler) Logger() *zap.Logger {
	return h.logger
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

// resolveViewableAgent resolves the target agent DB ID for read-only endpoints.
// If the URL :agent_id matches the authenticated agent, it returns the auth agent's DB ID.
// If different, it checks whether both agents share the same wallet (EVM address).
func (h *Handler) resolveViewableAgent(c *gin.Context) (uuid.UUID, bool) {
	authDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return uuid.UUID{}, false
	}
	dbID, ok := authDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return uuid.UUID{}, false
	}

	urlAgentID := c.Param("agent_id")
	authAgentID, _ := c.Get("agent_id")

	// Same agent -- fast path
	if urlAgentID == "" || urlAgentID == fmt.Sprintf("%v", authAgentID) {
		return dbID, true
	}

	// Different agent requested -- verify wallet ownership
	authAgent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to look up auth agent", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "agent lookup failed"})
		return uuid.UUID{}, false
	}

	if authAgent.EVMAddress == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "no wallet linked, cannot view other agents"})
		return uuid.UUID{}, false
	}

	targetAgent, err := h.store.GetAgentByID(c.Request.Context(), urlAgentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return uuid.UUID{}, false
	}

	if !strings.EqualFold(authAgent.EVMAddress, targetAgent.EVMAddress) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return uuid.UUID{}, false
	}

	return targetAgent.ID, true
}
