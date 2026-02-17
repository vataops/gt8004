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

	"github.com/GT8004/gt8004-analytics/internal/analytics"
	"github.com/GT8004/gt8004-analytics/internal/cache"
	"github.com/GT8004/gt8004-analytics/internal/config"
	"github.com/GT8004/gt8004-analytics/internal/handler"
	"github.com/GT8004/gt8004-analytics/internal/retention"
	"github.com/GT8004/gt8004-analytics/internal/server"
	"github.com/GT8004/gt8004-analytics/internal/store"
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

	// Database (shared DB with Registry service)
	db, err := store.New(ctx, cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Redis cache (optional -- nil cache = no-op fallback)
	redisCache, err := cache.New(cfg.RedisURL, logger)
	if err != nil {
		logger.Warn("failed to connect to redis, caching disabled", zap.Error(err))
	}
	if redisCache != nil {
		defer redisCache.Close()
	}

	// Body retention cleanup job
	retentionJob := retention.NewJob(db, cfg.BodyRetentionDays, logger)
	retentionJob.Start()

	// Analytics calculators
	custAnalytics := analytics.NewCustomerAnalytics(db, logger)
	revAnalytics := analytics.NewRevenueAnalytics(db, logger)
	perfAnalytics := analytics.NewPerformanceAnalytics(db, logger)

	// Benchmark calculator (background job)
	benchCalc := analytics.NewBenchmarkCalculator(db, logger, time.Duration(cfg.BenchmarkInterval)*time.Second)
	benchCalc.Start()

	// Reputation calculator (background job)
	repCalc := analytics.NewReputationCalculator(db, logger, time.Duration(cfg.ReputationInterval)*time.Second)
	repCalc.Start()

	// Handler
	h := handler.New(
		db,
		custAnalytics, revAnalytics, perfAnalytics,
		redisCache,
		logger,
		cfg.RegistryURL,
		cfg.ChainIDs(),
	)

	// Router + HTTP server
	router := server.NewRouter(cfg, h)
	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Metrics server (prometheus)
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.Handler())
	metricsServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.MetricsPort),
		Handler: metricsMux,
	}

	// Start servers
	errCh := make(chan error, 2)
	go func() { errCh <- httpServer.ListenAndServe() }()
	go func() { errCh <- metricsServer.ListenAndServe() }()

	logger.Info("Analytics service started",
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

	benchCalc.Stop()
	repCalc.Stop()
	retentionJob.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	httpServer.Shutdown(shutdownCtx)
	metricsServer.Shutdown(shutdownCtx)

	logger.Info("Analytics service stopped")
}
