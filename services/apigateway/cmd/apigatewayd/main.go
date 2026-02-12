package main

import (
	"github.com/GT8004/apigateway/internal/config"
	"github.com/GT8004/apigateway/internal/router"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load config
	cfg := config.Load()

	// Setup logger
	var logger *zap.Logger
	var err error
	if cfg.LogLevel == "debug" {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	// Set Gin mode
	if cfg.LogLevel == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin engine
	r := gin.New()

	// Setup router
	router.Setup(r, cfg, logger)

	// Start server
	logger.Info("API Gateway starting",
		zap.String("port", cfg.Port),
		zap.String("ingest_url", cfg.IngestURL),
		zap.String("analytics_url", cfg.AnalyticsURL),
		zap.String("discovery_url", cfg.DiscoveryURL),
		zap.String("registry_url", cfg.RegistryURL),
	)

	if err := r.Run(":" + cfg.Port); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
