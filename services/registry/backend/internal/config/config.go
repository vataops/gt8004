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
}

// SupportedNetworks maps chain ID to its ERC-8004 registry configuration.
// Populated by init() based on NETWORK_MODE env var.
var SupportedNetworks map[int]NetworkConfig

func init() {
	switch os.Getenv("NETWORK_MODE") {
	case "mainnet":
		SupportedNetworks = map[int]NetworkConfig{
			1: {ChainID: 1, RegistryAddr: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", ReputationAddr: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", RegistryRPC: "https://ethereum-rpc.publicnode.com"},
		}
	default: // "testnet" or unset
		SupportedNetworks = map[int]NetworkConfig{
			84532:    {ChainID: 84532, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", ReputationAddr: "0x8004B663056A597Dffe9eCcC1965A193B7388713", RegistryRPC: "https://base-sepolia-rpc.publicnode.com"},
			11155111: {ChainID: 11155111, RegistryAddr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", ReputationAddr: "", RegistryRPC: "https://ethereum-sepolia-rpc.publicnode.com"},
		}
	}
}

type Config struct {
	Port        int    `mapstructure:"PORT"`
	MetricsPort int    `mapstructure:"METRICS_PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
	DatabaseURL string `mapstructure:"DATABASE_URL"`

	// ERC-8004 Identity
	IdentityRegistryAddr string `mapstructure:"IDENTITY_REGISTRY_ADDRESS"`
	IdentityRegistryRPC  string `mapstructure:"IDENTITY_REGISTRY_RPC"`

	// Redis
	RedisURL string `mapstructure:"REDIS_URL"`

	// ERC-8004 Registration
	GT8004TokenID  int64  `mapstructure:"GT8004_TOKEN_ID"`
	GT8004AgentURI string `mapstructure:"GT8004_AGENT_URI"`

	// Gateway
	GatewayBaseURL string `mapstructure:"GATEWAY_BASE_URL"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("METRICS_PORT", 8081)
	viper.SetDefault("LOG_LEVEL", "debug")

	if os.Getenv("NETWORK_MODE") == "mainnet" {
		viper.SetDefault("IDENTITY_REGISTRY_RPC", "https://ethereum-rpc.publicnode.com")
	} else {
		viper.SetDefault("IDENTITY_REGISTRY_RPC", "https://sepolia.base.org")
	}
	viper.SetDefault("IDENTITY_REGISTRY_ADDRESS", "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432")

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.MetricsPort = viper.GetInt("METRICS_PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.IdentityRegistryAddr = viper.GetString("IDENTITY_REGISTRY_ADDRESS")
	cfg.IdentityRegistryRPC = viper.GetString("IDENTITY_REGISTRY_RPC")
	cfg.RedisURL = viper.GetString("REDIS_URL")
	cfg.GT8004TokenID = viper.GetInt64("GT8004_TOKEN_ID")
	cfg.GT8004AgentURI = viper.GetString("GT8004_AGENT_URI")
	cfg.GatewayBaseURL = viper.GetString("GATEWAY_BASE_URL")
	if cfg.GatewayBaseURL == "" {
		cfg.GatewayBaseURL = "http://localhost:8080"
	}

	return cfg, nil
}
