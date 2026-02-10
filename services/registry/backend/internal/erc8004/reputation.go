package erc8004

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
)

var selectorGetSummary = crypto.Keccak256([]byte("getSummary(uint256)"))[:4]

// GetReputationSummary calls getSummary(tokenID) on the IReputationRegistry contract.
// Returns (normalizedScore, feedbackCount, error).
// If ethClient is not connected, returns (0, 0, nil) for graceful degradation.
func (c *Client) GetReputationSummary(ctx context.Context, tokenID int64) (float64, int64, error) {
	if c.ethClient == nil {
		return 0, 0, nil
	}

	// ABI-encode: selector + uint256(tokenID)
	tokenIDBig := new(big.Int).SetInt64(tokenID)
	paddedTokenID := common.LeftPadBytes(tokenIDBig.Bytes(), 32)
	data := append(selectorGetSummary, paddedTokenID...)

	msg := ethereum.CallMsg{
		To:   &c.contractAddr,
		Data: data,
	}

	result, err := c.ethClient.CallContract(ctx, msg, nil)
	if err != nil {
		c.logger.Debug("getSummary call failed, skipping on-chain reputation",
			zap.Int64("token_id", tokenID), zap.Error(err))
		return 0, 0, nil // non-fatal: contract may not support IReputationRegistry
	}

	if len(result) < 64 {
		return 0, 0, nil // no reputation data
	}

	// Decode: int128 score (first 32 bytes, signed) + uint256 count (next 32 bytes)
	scoreBig := new(big.Int).SetBytes(result[:32])
	// int128 is signed — check high bit of ABI-encoded 256-bit value
	if len(result) >= 32 && result[0]&0x80 != 0 {
		max256 := new(big.Int).Lsh(big.NewInt(1), 256)
		scoreBig.Sub(scoreBig, max256)
	}

	countBig := new(big.Int).SetBytes(result[32:64])

	return float64(scoreBig.Int64()), countBig.Int64(), nil
}

// PostReputation sends reputation feedback for an agent to the on-chain reputation registry.
// Stub — write transactions require a signing key and are out of scope for this iteration.
func (c *Client) PostReputation(ctx context.Context, agentTokenID int64, score float64) error {
	c.logger.Debug("posting reputation (stub — write tx not implemented)",
		zap.Int64("agent_token_id", agentTokenID),
		zap.Float64("score", score),
	)
	return nil
}

// QueryAgent queries the ERC-8004 identity registry for agent info.
// Returns (agentURI, reputationScore, error).
func (c *Client) QueryAgent(ctx context.Context, tokenID int64) (string, float64, error) {
	uri, err := c.GetAgentURI(ctx, tokenID)
	if err != nil {
		return "", 0, fmt.Errorf("get agent uri: %w", err)
	}

	score, _, err := c.GetReputationSummary(ctx, tokenID)
	if err != nil {
		return uri, 0, nil // non-fatal
	}

	return uri, score, nil
}
