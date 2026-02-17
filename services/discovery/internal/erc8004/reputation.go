package erc8004

import (
	"context"
	"math"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
)

// IReputationRegistry function selectors.
var (
	selGetSummary = crypto.Keccak256([]byte("getSummary(uint256,address[],string,string)"))[:4]
	selGetClients = crypto.Keccak256([]byte("getClients(uint256)"))[:4]
)

// hasReputation returns true if the client has a reputation registry configured.
func (c *Client) hasReputation() bool {
	return c.ethClient != nil && c.reputationAddr != (common.Address{})
}

// GetReputationSummary fetches the on-chain reputation score for a token.
// Returns (score, feedbackCount, error).
func (c *Client) GetReputationSummary(ctx context.Context, tokenID int64) (float64, int64, error) {
	if !c.hasReputation() {
		return 0, 0, nil
	}

	// First fetch client addresses (required by contract).
	clients, err := c.getClients(ctx, tokenID)
	if err != nil || len(clients) == 0 {
		return 0, 0, nil
	}

	// ABI-encode: getSummary(uint256, address[], string, string)
	addrDataSlots := 1 + int64(len(clients))
	addrDataBytes := addrDataSlots * 32
	tag1Offset := 128 + addrDataBytes
	tag2Offset := tag1Offset + 32

	totalSlots := 4 + addrDataSlots + 2
	buf := make([]byte, 0, 4+totalSlots*32)
	buf = append(buf, selGetSummary...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(big.NewInt(128).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(big.NewInt(tag1Offset).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(big.NewInt(tag2Offset).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(big.NewInt(int64(len(clients))).Bytes(), 32)...)
	for _, addr := range clients {
		buf = append(buf, common.LeftPadBytes(addr.Bytes(), 32)...)
	}
	buf = append(buf, make([]byte, 32)...) // tag1 length = 0
	buf = append(buf, make([]byte, 32)...) // tag2 length = 0

	addr := c.reputationAddr
	result, err := c.ethClient.CallContract(ctx, ethereum.CallMsg{To: &addr, Data: buf}, nil)
	if err != nil {
		c.logger.Debug("getSummary call failed", zap.Int64("token_id", tokenID), zap.Error(err))
		return 0, 0, nil
	}
	if len(result) < 96 {
		return 0, 0, nil
	}

	count := new(big.Int).SetBytes(result[:32]).Int64()

	valueBig := new(big.Int).SetBytes(result[32:64])
	if result[32]&0x80 != 0 {
		max256 := new(big.Int).Lsh(big.NewInt(1), 256)
		valueBig.Sub(valueBig, max256)
	}

	decimals := int(result[95])
	score := float64(valueBig.Int64())
	if decimals > 0 {
		score /= math.Pow(10, float64(decimals))
	}

	return score, count, nil
}

// getClients calls getClients(agentId) on the reputation registry.
func (c *Client) getClients(ctx context.Context, tokenID int64) ([]common.Address, error) {
	buf := make([]byte, 0, 4+32)
	buf = append(buf, selGetClients...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)

	addr := c.reputationAddr
	result, err := c.ethClient.CallContract(ctx, ethereum.CallMsg{To: &addr, Data: buf}, nil)
	if err != nil {
		return nil, err
	}
	if len(result) < 64 {
		return nil, nil
	}

	arrLen := new(big.Int).SetBytes(result[32:64]).Int64()
	if arrLen == 0 {
		return nil, nil
	}

	addrs := make([]common.Address, 0, arrLen)
	for i := int64(0); i < arrLen; i++ {
		start := 64 + i*32
		if start+32 > int64(len(result)) {
			break
		}
		addrs = append(addrs, common.BytesToAddress(result[start+12:start+32]))
	}
	return addrs, nil
}
