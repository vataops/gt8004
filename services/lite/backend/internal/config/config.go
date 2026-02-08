package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Port        int    `mapstructure:"PORT"`
	MetricsPort int    `mapstructure:"METRICS_PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`

	// Database
	DatabaseURL string `mapstructure:"DATABASE_URL"`

	// EVM (Escrow on Base)
	EVMRPCURL             string `mapstructure:"EVM_RPC_URL"`
	EscrowContractAddress string `mapstructure:"ESCROW_CONTRACT_ADDRESS"`
	OperatorEVMKey        string `mapstructure:"AES_OPERATOR_EVM_KEY"`

	// x402 Payment
	X402FacilitatorURL string `mapstructure:"X402_FACILITATOR_URL"`
	PaymentRecipient   string `mapstructure:"AES_PAYMENT_RECIPIENT"`

	// ERC-8004 Identity
	IdentityRegistryAddress string `mapstructure:"IDENTITY_REGISTRY_ADDRESS"`
	IdentityRegistryRPC     string `mapstructure:"IDENTITY_REGISTRY_RPC"`

	// Admin
	AdminAPIKey string `mapstructure:"ADMIN_API_KEY"`
}

func Load() (*Config, error) {
	viper.AutomaticEnv()

	viper.SetDefault("PORT", 8080)
	viper.SetDefault("METRICS_PORT", 8081)
	viper.SetDefault("LOG_LEVEL", "debug")
	viper.SetDefault("EVM_RPC_URL", "https://sepolia.base.org")
	viper.SetDefault("IDENTITY_REGISTRY_RPC", "https://eth.llamarpc.com")

	cfg := &Config{}
	cfg.Port = viper.GetInt("PORT")
	cfg.MetricsPort = viper.GetInt("METRICS_PORT")
	cfg.LogLevel = viper.GetString("LOG_LEVEL")
	cfg.DatabaseURL = viper.GetString("DATABASE_URL")
	cfg.EVMRPCURL = viper.GetString("EVM_RPC_URL")
	cfg.EscrowContractAddress = viper.GetString("ESCROW_CONTRACT_ADDRESS")
	cfg.OperatorEVMKey = viper.GetString("AES_OPERATOR_EVM_KEY")
	cfg.X402FacilitatorURL = viper.GetString("X402_FACILITATOR_URL")
	cfg.PaymentRecipient = viper.GetString("AES_PAYMENT_RECIPIENT")
	cfg.IdentityRegistryAddress = viper.GetString("IDENTITY_REGISTRY_ADDRESS")
	cfg.IdentityRegistryRPC = viper.GetString("IDENTITY_REGISTRY_RPC")
	cfg.AdminAPIKey = viper.GetString("ADMIN_API_KEY")

	return cfg, nil
}
