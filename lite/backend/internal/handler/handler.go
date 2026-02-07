package handler

import (
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
	"github.com/AEL/aes-lite/internal/evm"
	"github.com/AEL/aes-lite/internal/identity"
	"github.com/AEL/aes-lite/internal/store"
)

// Handler holds dependencies for all HTTP handlers.
type Handler struct {
	store    *store.Store
	engine   channel.Engine
	escrow   *evm.EscrowClient
	identity *identity.Verifier
	logger   *zap.Logger
}

func New(s *store.Store, engine channel.Engine, escrow *evm.EscrowClient, id *identity.Verifier, logger *zap.Logger) *Handler {
	return &Handler{
		store:    s,
		engine:   engine,
		escrow:   escrow,
		identity: id,
		logger:   logger,
	}
}
