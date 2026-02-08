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
	Port        int    `mapstructure:"PORT"`
	MetricsPort int    `mapstructure:"METRICS_PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
	DatabaseURL string `mapstructure:"DATABASE_URL"`

	// ERC-8004 Identity
	IdentityRegistryAddr string `mapstructure:"IDENTITY_REGISTRY_ADDRESS"`
	IdentityRegistryRPC  string `mapstructure:"IDENTITY_REGISTRY_RPC"`

	// Ingest pipeline
	IngestWorkers    int `mapstructure:"INGEST_WORKERS"`
	IngestBufferSize int `mapstructure:"INGEST_BUFFER_SIZE"`

	// Benchmark
	BenchmarkInterval int `mapstructure:"BENCHMARK_INTERVAL"`

	// Admin
	AdminAPIKey string `mapstructure:"ADMIN_API_KEY"`

	// ERC-8004 Registration
	GT8004TokenID  int64  `mapstructure:"GT8004_TOKEN_ID"`
	GT8004AgentURI string `mapstructure:"GT8004_AGENT_URI"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("METRICS_PORT", 8081)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("IDENTITY_REGISTRY_RPC", "https://sepolia.base.org")
	viper.SetDefault("IDENTITY_REGISTRY_ADDRESS", "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432")
	viper.SetDefault("INGEST_WORKERS", 4)
	viper.SetDefault("INGEST_BUFFER_SIZE", 1000)
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
	cfg.BenchmarkInterval = viper.GetInt("BENCHMARK_INTERVAL")
	cfg.AdminAPIKey = viper.GetString("ADMIN_API_KEY")
	cfg.GT8004TokenID = viper.GetInt64("GT8004_TOKEN_ID")
	cfg.GT8004AgentURI = viper.GetString("GT8004_AGENT_URI")

	return cfg, nil
}
