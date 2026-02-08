package handler

import (
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
	"github.com/AEL/aes-lite/internal/evm"
	"github.com/AEL/aes-common/identity"
	"github.com/AEL/aes-lite/internal/settlement"
	"github.com/AEL/aes-lite/internal/store"
	"github.com/AEL/aes-common/ws"
)

// Handler holds dependencies for all HTTP handlers.
type Handler struct {
	store    *store.Store
	engine   channel.Engine
	escrow   *evm.EscrowClient
	identity *identity.Verifier
	settler  *settlement.Settler
	hub      *ws.Hub
	logger   *zap.Logger
}

func New(s *store.Store, engine channel.Engine, escrow *evm.EscrowClient, id *identity.Verifier, settler *settlement.Settler, hub *ws.Hub, logger *zap.Logger) *Handler {
	return &Handler{
		store:    s,
		engine:   engine,
		escrow:   escrow,
		identity: id,
		settler:  settler,
		hub:      hub,
		logger:   logger,
	}
}
