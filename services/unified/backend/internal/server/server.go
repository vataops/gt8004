package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/config"
	"github.com/GT8004/gt8004/internal/handler"
)

type Server struct {
	httpServer *http.Server
	cfg        *config.Config
	logger     *zap.Logger
}

func New(cfg *config.Config, h *handler.Handler, logger *zap.Logger) *Server {
	router := NewRouter(cfg, h, logger)
	return &Server{
		httpServer: &http.Server{
			Addr:         fmt.Sprintf(":%d", cfg.Port),
			Handler:      router,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		cfg:    cfg,
		logger: logger,
	}
}

func (s *Server) Start() error {
	s.logger.Info("starting GT8004 server", zap.Int("port", s.cfg.Port))
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down server")
	return s.httpServer.Shutdown(ctx)
}
