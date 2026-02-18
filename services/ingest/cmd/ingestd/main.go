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

	"github.com/GT8004/gt8004-ingest/internal/config"
	"github.com/GT8004/gt8004-ingest/internal/handler"
	"github.com/GT8004/gt8004-ingest/internal/ingest"
	"github.com/GT8004/gt8004-ingest/internal/server"
	"github.com/GT8004/gt8004-ingest/internal/store"
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

	// Database
	ctx := context.Background()
	dbStore, err := store.New(ctx, cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer dbStore.Close()

	// Verifier and enricher
	verifier := ingest.NewVerifier(dbStore, logger)
	enricher := ingest.NewEnricher(dbStore, verifier, logger, cfg.MaxBodySizeBytes)
	worker := ingest.NewWorker(enricher, cfg.IngestWorkers, cfg.IngestBufferSize, logger)
	worker.Start()

	// Handler and router
	h := handler.New(dbStore, worker, logger)
	router := server.NewRouter(h)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	logger.Info("Ingest service started",
		zap.Int("port", cfg.Port),
		zap.Int("workers", cfg.IngestWorkers),
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

	worker.Stop()
	logger.Info("Ingest service stopped")
}
