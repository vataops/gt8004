package erc8004

import (
	"go.uber.org/zap"
)

// Client manages ERC-8004 identity and reputation registry interactions.
type Client struct {
	registryAddr string
	registryRPC  string
	gt8004TokenID   int64
	gt8004AgentURI  string
	logger       *zap.Logger
}

// Config holds configuration for the ERC-8004 client.
type Config struct {
	RegistryAddr string
	RegistryRPC  string
	GT8004TokenID   int64
	GT8004AgentURI  string
}

func NewClient(cfg Config, logger *zap.Logger) *Client {
	return &Client{
		registryAddr: cfg.RegistryAddr,
		registryRPC:  cfg.RegistryRPC,
		gt8004TokenID:   cfg.GT8004TokenID,
		gt8004AgentURI:  cfg.GT8004AgentURI,
		logger:       logger,
	}
}
