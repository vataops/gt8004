package handler

import (
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-discovery/internal/store"
	netsync "github.com/GT8004/gt8004-discovery/internal/sync"
)

type Handler struct {
	store   *store.Store
	logger  *zap.Logger
	syncJob *netsync.Job
}

func New(s *store.Store, logger *zap.Logger, syncJob *netsync.Job) *Handler {
	return &Handler{
		store:   s,
		logger:  logger,
		syncJob: syncJob,
	}
}
