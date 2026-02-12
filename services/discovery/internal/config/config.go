package config

import "github.com/spf13/viper"

// NetworkConfig holds ERC-8004 registry info for a specific chain.
type NetworkConfig struct {
	ChainID      int
	RegistryAddr string
	RegistryRPC  string
}

// SupportedNetworks maps chain ID to its ERC-8004 registry configuration.
var SupportedNetworks = map[int]NetworkConfig{
	84532:    {ChainID: 84532, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", RegistryRPC: "https://base-sepolia-rpc.publicnode.com"},
	11155111: {ChainID: 11155111, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", RegistryRPC: "https://ethereum-sepolia-rpc.publicnode.com"},
}

type Config struct {
	Port             int    `mapstructure:"PORT"`
	LogLevel         string `mapstructure:"LOG_LEVEL"`
	DatabaseURL      string `mapstructure:"DATABASE_URL"`
	ScanSyncInterval int    `mapstructure:"SCAN_SYNC_INTERVAL"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("SCAN_SYNC_INTERVAL", 86400)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.ScanSyncInterval = viper.GetInt("SCAN_SYNC_INTERVAL")

	return cfg, nil
}
