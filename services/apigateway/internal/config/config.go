package config

import (
	"log"

	"github.com/spf13/viper"
)

type Config struct {
	Port         string `mapstructure:"port"`
	AnalyticsURL string `mapstructure:"analytics_url"`
	DiscoveryURL string `mapstructure:"discovery_url"`
	RegistryURL  string `mapstructure:"registry_url"`
	IngestURL    string `mapstructure:"ingest_url"`
	LogLevel     string `mapstructure:"log_level"`
}

func Load() *Config {
	viper.AutomaticEnv()

	// Defaults
	viper.SetDefault("port", "8080")
	viper.SetDefault("analytics_url", "http://analytics:8080")
	viper.SetDefault("discovery_url", "http://discovery:8080")
	viper.SetDefault("registry_url", "http://registry:8080")
	viper.SetDefault("ingest_url", "http://ingest:9094")
	viper.SetDefault("log_level", "info")

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}

	return &cfg
}
