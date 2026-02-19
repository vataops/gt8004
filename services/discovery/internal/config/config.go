package config

import (
	"os"

	"github.com/spf13/viper"
)

// NetworkConfig holds ERC-8004 registry info for a specific chain.
type NetworkConfig struct {
	ChainID        int
	RegistryAddr   string
	ReputationAddr string
	RegistryRPC    string
	DeployBlock    uint64 // block number at which the registry was deployed; scan starts here
}

// SupportedNetworks maps chain ID to its ERC-8004 registry configuration.
// Populated by init() based on NETWORK_MODE env var.
var SupportedNetworks map[int]NetworkConfig

func init() {
	switch os.Getenv("NETWORK_MODE") {
	case "mainnet":
		baseRPC := os.Getenv("BASE_RPC_URL")
		if baseRPC == "" {
			baseRPC = "https://base-rpc.publicnode.com"
		}
		SupportedNetworks = map[int]NetworkConfig{
			1:    {ChainID: 1, RegistryAddr: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", ReputationAddr: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", RegistryRPC: "https://ethereum-rpc.publicnode.com", DeployBlock: 24339900},
			8453: {ChainID: 8453, RegistryAddr: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", ReputationAddr: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", RegistryRPC: baseRPC, DeployBlock: 41000000},
		}
	default: // "testnet" or unset
		SupportedNetworks = map[int]NetworkConfig{
			84532:    {ChainID: 84532, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", ReputationAddr: "0x8004B663056A597Dffe9eCcC1965A193B7388713", RegistryRPC: "https://base-sepolia-rpc.publicnode.com", DeployBlock: 36304100},
			11155111: {ChainID: 11155111, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", ReputationAddr: "", RegistryRPC: "https://ethereum-sepolia-rpc.publicnode.com", DeployBlock: 9989400},
		}
	}
}

type Config struct {
	Port             int    `mapstructure:"PORT"`
	LogLevel         string `mapstructure:"LOG_LEVEL"`
	DatabaseURL      string `mapstructure:"DATABASE_URL"`
	ScanSyncInterval int    `mapstructure:"SCAN_SYNC_INTERVAL"`
	InternalSecret   string `mapstructure:"INTERNAL_SECRET"`

	// Backfill tuning
	BackfillInterval  int `mapstructure:"BACKFILL_INTERVAL"`   // seconds between backfill cycles (default 1800 = 30min)
	BackfillWorkers   int `mapstructure:"BACKFILL_WORKERS"`    // concurrent backfill goroutines (default 3)
	BackfillBatchSize int `mapstructure:"BACKFILL_BATCH_SIZE"` // tokens per backfill cycle (default 200)

	// Reputation tuning
	ReputationInterval int `mapstructure:"REPUTATION_INTERVAL"` // seconds between reputation refresh (default 3600 = 1hr)

	// RPC concurrency
	ResolveWorkers int `mapstructure:"RESOLVE_WORKERS"` // concurrent resolve goroutines for ownership+URI (default 10)
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("SCAN_SYNC_INTERVAL", 3600)
	viper.SetDefault("BACKFILL_INTERVAL", 1800)
	viper.SetDefault("BACKFILL_WORKERS", 3)
	viper.SetDefault("BACKFILL_BATCH_SIZE", 200)
	viper.SetDefault("REPUTATION_INTERVAL", 3600)
	viper.SetDefault("RESOLVE_WORKERS", 10)

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.ScanSyncInterval = viper.GetInt("SCAN_SYNC_INTERVAL")
	cfg.InternalSecret = viper.GetString("INTERNAL_SECRET")
	cfg.BackfillInterval = viper.GetInt("BACKFILL_INTERVAL")
	cfg.BackfillWorkers = viper.GetInt("BACKFILL_WORKERS")
	cfg.BackfillBatchSize = viper.GetInt("BACKFILL_BATCH_SIZE")
	cfg.ReputationInterval = viper.GetInt("REPUTATION_INTERVAL")
	cfg.ResolveWorkers = viper.GetInt("RESOLVE_WORKERS")

	return cfg, nil
}
