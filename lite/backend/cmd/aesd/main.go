package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
	"github.com/AEL/aes-lite/internal/config"
	"github.com/AEL/aes-lite/internal/evm"
	"github.com/AEL/aes-lite/internal/handler"
	"github.com/AEL/aes-lite/internal/identity"
	"github.com/AEL/aes-lite/internal/server"
	"github.com/AEL/aes-lite/internal/settlement"
	"github.com/AEL/aes-lite/internal/store"
	"github.com/AEL/aes-lite/internal/ws"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	if cfg.LogLevel == "debug" {
		logger, _ = zap.NewDevelopment()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := store.New(ctx, cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Create Lite channel engine (DB-based)
	engine := channel.NewLiteEngine(db.Pool(), logger)

	// ERC-8004 identity verifier
	idVerifier := identity.NewVerifier(cfg.IdentityRegistryAddress, cfg.IdentityRegistryRPC, logger)

	// Escrow contract client (nil if not configured)
	escrow, err := evm.NewEscrowClient(cfg.EVMRPCURL, cfg.EscrowContractAddress, cfg.OperatorEVMKey, logger)
	if err != nil {
		logger.Warn("escrow client disabled", zap.Error(err))
	}

	// Settlement orchestrator
	settler := settlement.New(db, escrow, logger)

	// WebSocket hub for real-time events
	hub := ws.NewHub(logger)

	h := handler.New(db, engine, escrow, idVerifier, settler, hub, logger)
	srv := server.New(cfg, h, logger)

	// Metrics server
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.Handler())
	metricsServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.MetricsPort),
		Handler: metricsMux,
	}

	// Start servers
	errCh := make(chan error, 2)
	go func() { errCh <- srv.Start() }()
	go func() { errCh <- metricsServer.ListenAndServe() }()

	logger.Info("AES server started",
		zap.Int("port", cfg.Port),
		zap.Int("metrics_port", cfg.MetricsPort),
	)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		logger.Info("received shutdown signal", zap.String("signal", sig.String()))
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			logger.Error("server error", zap.Error(err))
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	srv.Shutdown(shutdownCtx)
	metricsServer.Shutdown(shutdownCtx)

	logger.Info("AES server stopped")
}
