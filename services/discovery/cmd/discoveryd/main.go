package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004-discovery/internal/config"
	"github.com/GT8004/gt8004-discovery/internal/erc8004"
	"github.com/GT8004/gt8004-discovery/internal/handler"
	"github.com/GT8004/gt8004-discovery/internal/server"
	"github.com/GT8004/gt8004-discovery/internal/store"
	netsync "github.com/GT8004/gt8004-discovery/internal/sync"
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

	// Database
	db, err := store.New(ctx, cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// ERC-8004 multi-network registry
	networkConfigs := make(map[int]erc8004.Config, len(config.SupportedNetworks))
	for chainID, nc := range config.SupportedNetworks {
		networkConfigs[chainID] = erc8004.Config{
			ChainID:      nc.ChainID,
			RegistryAddr: nc.RegistryAddr,
			RegistryRPC:  nc.RegistryRPC,
		}
	}
	erc8004Registry := erc8004.NewRegistry(networkConfigs, logger)

	// Network agent sync job
	syncJob := netsync.NewJob(db, erc8004Registry, logger, time.Duration(cfg.ScanSyncInterval)*time.Second)
	syncJob.Start()

	// Handler and router
	h := handler.New(db, logger)
	router := server.NewRouter(h)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	logger.Info("Discovery service started", zap.Int("port", cfg.Port))

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

	syncJob.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	srv.Shutdown(shutdownCtx)

	logger.Info("Discovery service stopped")
}
