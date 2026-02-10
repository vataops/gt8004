package config

import "github.com/spf13/viper"

type Config struct {
	Port         int    `mapstructure:"PORT"`
	LogLevel     string `mapstructure:"LOG_LEVEL"`
	RegistryURL  string `mapstructure:"REGISTRY_URL"`
	AnalyticsURL string `mapstructure:"ANALYTICS_URL"`
	RateLimit    int    `mapstructure:"RATE_LIMIT"`
	RateBurst    int    `mapstructure:"RATE_BURST"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("REGISTRY_URL", "http://registry:8080")
	viper.SetDefault("ANALYTICS_URL", "http://analytics:8080")
	viper.SetDefault("RATE_LIMIT", 10)
	viper.SetDefault("RATE_BURST", 100)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.RegistryURL = viper.GetString("REGISTRY_URL")
	cfg.AnalyticsURL = viper.GetString("ANALYTICS_URL")
	cfg.RateLimit = viper.GetInt("RATE_LIMIT")
	cfg.RateBurst = viper.GetInt("RATE_BURST")

	return cfg, nil
}
