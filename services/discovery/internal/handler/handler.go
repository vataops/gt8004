package handler

import (
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-discovery/internal/store"
)

type Handler struct {
	store  *store.Store
	logger *zap.Logger
}

func New(s *store.Store, logger *zap.Logger) *Handler {
	return &Handler{
		store:  s,
		logger: logger,
	}
}
