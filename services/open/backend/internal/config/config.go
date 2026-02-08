package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Port                 int    `mapstructure:"PORT"`
	MetricsPort          int    `mapstructure:"METRICS_PORT"`
	LogLevel             string `mapstructure:"LOG_LEVEL"`
	DatabaseURL          string `mapstructure:"DATABASE_URL"`
	IdentityRegistryAddr string `mapstructure:"IDENTITY_REGISTRY_ADDRESS"`
	IdentityRegistryRPC  string `mapstructure:"IDENTITY_REGISTRY_RPC"`
	IngestWorkers        int    `mapstructure:"INGEST_WORKERS"`
	IngestBufferSize     int    `mapstructure:"INGEST_BUFFER_SIZE"`
	AlertCheckInterval   int    `mapstructure:"ALERT_CHECK_INTERVAL"`
	BenchmarkInterval    int    `mapstructure:"BENCHMARK_INTERVAL"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("METRICS_PORT", 8081)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("IDENTITY_REGISTRY_RPC", "https://eth.llamarpc.com")
	viper.SetDefault("INGEST_WORKERS", 4)
	viper.SetDefault("INGEST_BUFFER_SIZE", 1000)
	viper.SetDefault("ALERT_CHECK_INTERVAL", 60)
	viper.SetDefault("BENCHMARK_INTERVAL", 300)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.MetricsPort = viper.GetInt("METRICS_PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.IdentityRegistryAddr = viper.GetString("IDENTITY_REGISTRY_ADDRESS")
	cfg.IdentityRegistryRPC = viper.GetString("IDENTITY_REGISTRY_RPC")
	cfg.IngestWorkers = viper.GetInt("INGEST_WORKERS")
	cfg.IngestBufferSize = viper.GetInt("INGEST_BUFFER_SIZE")
	cfg.AlertCheckInterval = viper.GetInt("ALERT_CHECK_INTERVAL")
	cfg.BenchmarkInterval = viper.GetInt("BENCHMARK_INTERVAL")

	return cfg, nil
}
