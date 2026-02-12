package config

import "github.com/spf13/viper"

type Config struct {
	Port             int    `mapstructure:"PORT"`
	LogLevel         string `mapstructure:"LOG_LEVEL"`
	DatabaseURL      string `mapstructure:"DATABASE_URL"`
	IngestWorkers    int    `mapstructure:"INGEST_WORKERS"`
	IngestBufferSize int    `mapstructure:"INGEST_BUFFER_SIZE"`
	MaxBodySizeBytes int    `mapstructure:"MAX_BODY_SIZE_BYTES"`
	RateLimit        int    `mapstructure:"RATE_LIMIT"`
	RateBurst        int    `mapstructure:"RATE_BURST"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("DATABASE_URL", "postgres://gt8004:gt8004@postgres:5432/gt8004?sslmode=disable")
	viper.SetDefault("INGEST_WORKERS", 4)
	viper.SetDefault("INGEST_BUFFER_SIZE", 1000)
	viper.SetDefault("MAX_BODY_SIZE_BYTES", 51200)
	viper.SetDefault("RATE_LIMIT", 10)
	viper.SetDefault("RATE_BURST", 100)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.IngestWorkers = viper.GetInt("INGEST_WORKERS")
	cfg.IngestBufferSize = viper.GetInt("INGEST_BUFFER_SIZE")
	cfg.MaxBodySizeBytes = viper.GetInt("MAX_BODY_SIZE_BYTES")
	cfg.RateLimit = viper.GetInt("RATE_LIMIT")
	cfg.RateBurst = viper.GetInt("RATE_BURST")

	return cfg, nil
}
