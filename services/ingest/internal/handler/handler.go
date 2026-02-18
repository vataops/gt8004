package handler

import (
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-ingest/internal/ingest"
	"github.com/GT8004/gt8004-ingest/internal/store"
)

type Handler struct {
	store  *store.Store
	worker *ingest.Worker
	logger *zap.Logger
}

func New(
	s *store.Store,
	worker *ingest.Worker,
	logger *zap.Logger,
) *Handler {
	return &Handler{
		store:  s,
		worker: worker,
		logger: logger,
	}
}

func (h *Handler) Store() *store.Store {
	return h.store
}
