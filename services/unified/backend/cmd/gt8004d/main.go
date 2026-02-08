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

	"github.com/GT8004/gt8004-common/identity"
	"github.com/GT8004/gt8004-common/ws"
	"github.com/GT8004/gt8004/internal/analytics"
	"github.com/GT8004/gt8004/internal/config"
	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/gateway"
	"github.com/GT8004/gt8004/internal/handler"
	"github.com/GT8004/gt8004/internal/ingest"
	"github.com/GT8004/gt8004/internal/server"
	"github.com/GT8004/gt8004/internal/store"
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

	// Database (single unified DB)
	db, err := store.New(ctx, cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// === Shared components ===

	// ERC-8004 identity verifier (from common)
	idVerifier := identity.NewVerifier(cfg.IdentityRegistryAddr, cfg.IdentityRegistryRPC, logger)

	// WebSocket hub for real-time events (from common)
	hub := ws.NewHub(logger)

	// === Open features ===

	// Ingest pipeline
	enricher := ingest.NewEnricher(db, logger)
	worker := ingest.NewWorker(enricher, cfg.IngestWorkers, cfg.IngestBufferSize, logger)
	worker.Start()

	// Analytics
	custAnalytics := analytics.NewCustomerAnalytics(db, logger)
	revAnalytics := analytics.NewRevenueAnalytics(db, logger)
	perfAnalytics := analytics.NewPerformanceAnalytics(db, logger)

	// Benchmark calculator
	benchCalc := analytics.NewBenchmarkCalculator(db, logger, time.Duration(cfg.BenchmarkInterval)*time.Second)
	benchCalc.Start()

	// Gateway
	proxy := gateway.NewProxy(db, logger)
	rateLimiter := gateway.NewRateLimiter(10, 100) // 10 req/s, burst 100

	// === ERC-8004 (multi-network registry) ===

	networkConfigs := make(map[int]erc8004.Config, len(config.SupportedNetworks))
	for chainID, nc := range config.SupportedNetworks {
		networkConfigs[chainID] = erc8004.Config{
			ChainID:      nc.ChainID,
			RegistryAddr: nc.RegistryAddr,
			RegistryRPC:  nc.RegistryRPC,
		}
	}
	erc8004Registry := erc8004.NewRegistry(networkConfigs, logger)

	// === Unified handler and server ===

	h := handler.New(
		db, idVerifier, hub, worker,
		custAnalytics, revAnalytics, perfAnalytics,
		proxy, rateLimiter,
		erc8004Registry,
		logger,
	)
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

	logger.Info("GT8004 server started",
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

	worker.Stop()
	benchCalc.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	srv.Shutdown(shutdownCtx)
	metricsServer.Shutdown(shutdownCtx)

	logger.Info("GT8004 server stopped")
}
