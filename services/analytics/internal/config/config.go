package config

import "github.com/spf13/viper"

type Config struct {
	Port              int    `mapstructure:"PORT"`
	MetricsPort       int    `mapstructure:"METRICS_PORT"`
	LogLevel          string `mapstructure:"LOG_LEVEL"`
	DatabaseURL       string `mapstructure:"DATABASE_URL"`
	RedisURL          string `mapstructure:"REDIS_URL"`
	IngestWorkers     int    `mapstructure:"INGEST_WORKERS"`
	IngestBufferSize  int    `mapstructure:"INGEST_BUFFER_SIZE"`
	BenchmarkInterval  int    `mapstructure:"BENCHMARK_INTERVAL"`
	MaxBodySizeBytes  int    `mapstructure:"MAX_BODY_SIZE_BYTES"`
	BodyRetentionDays int    `mapstructure:"BODY_RETENTION_DAYS"`
	GeoIPDBPath       string `mapstructure:"GEOIP_DB_PATH"`
	RegistryURL       string `mapstructure:"REGISTRY_URL"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("METRICS_PORT", 8081)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("INGEST_WORKERS", 4)
	viper.SetDefault("INGEST_BUFFER_SIZE", 1000)
	viper.SetDefault("BENCHMARK_INTERVAL", 300)
	viper.SetDefault("MAX_BODY_SIZE_BYTES", 51200)
	viper.SetDefault("BODY_RETENTION_DAYS", 30)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.MetricsPort = viper.GetInt("METRICS_PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.RedisURL = viper.GetString("REDIS_URL")
	cfg.IngestWorkers = viper.GetInt("INGEST_WORKERS")
	cfg.IngestBufferSize = viper.GetInt("INGEST_BUFFER_SIZE")
	cfg.BenchmarkInterval = viper.GetInt("BENCHMARK_INTERVAL")
	cfg.MaxBodySizeBytes = viper.GetInt("MAX_BODY_SIZE_BYTES")
	cfg.BodyRetentionDays = viper.GetInt("BODY_RETENTION_DAYS")
	cfg.GeoIPDBPath = viper.GetString("GEOIP_DB_PATH")
	cfg.RegistryURL = viper.GetString("REGISTRY_URL")

	return cfg, nil
}
