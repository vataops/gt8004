package erc8004

import (
	"context"

	"go.uber.org/zap"
)

// PostReputation sends reputation feedback for an agent to the on-chain reputation registry.
// This is a stub that will be implemented when the ERC-8004 contracts are deployed.
func (c *Client) PostReputation(ctx context.Context, agentTokenID int64, score float64) error {
	c.logger.Debug("posting reputation (stub)",
		zap.Int64("agent_token_id", agentTokenID),
		zap.Float64("score", score),
	)
	// TODO: Implement actual on-chain call to IReputationRegistry.giveFeedback()
	return nil
}

// QueryAgent queries the ERC-8004 identity registry for agent info.
// This replaces the stub in common/go/identity/identity.go.
func (c *Client) QueryAgent(ctx context.Context, tokenID int64) (string, float64, error) {
	c.logger.Debug("querying agent registry (stub)", zap.Int64("token_id", tokenID))
	// TODO: Implement actual on-chain call to IIdentityRegistry.getAgentURI() and
	// IReputationRegistry.getSummary()
	return "", 0, nil
}
