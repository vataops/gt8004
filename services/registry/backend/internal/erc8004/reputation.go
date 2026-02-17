package erc8004

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
)

// IReputationRegistry function selectors (ERC-8004 spec).
var (
	selGetSummary   = crypto.Keccak256([]byte("getSummary(uint256,address[],string,string)"))[:4]
	selGetClients   = crypto.Keccak256([]byte("getClients(uint256)"))[:4]
	selGetLastIndex = crypto.Keccak256([]byte("getLastIndex(uint256,address)"))[:4]
	selReadFeedback = crypto.Keccak256([]byte("readFeedback(uint256,address,uint64)"))[:4]
)

// Feedback represents a single on-chain feedback entry.
type Feedback struct {
	ClientAddress string  `json:"client_address"`
	FeedbackIndex int64   `json:"feedback_index"`
	Value         float64 `json:"value"`
	Tag1          string  `json:"tag1"`
	Tag2          string  `json:"tag2"`
	IsRevoked     bool    `json:"is_revoked"`
}

// hasReputation returns true if the client has a reputation registry configured.
func (c *Client) hasReputation() bool {
	return c.ethClient != nil && c.reputationAddr != (common.Address{})
}

// callReputation makes a read-only call to the reputation registry contract.
func (c *Client) callReputation(ctx context.Context, data []byte) ([]byte, error) {
	addr := c.reputationAddr
	msg := ethereum.CallMsg{To: &addr, Data: data}
	return c.ethClient.CallContract(ctx, msg, nil)
}

// GetReputationSummary calls getSummary on the IReputationRegistry.
// It first fetches the client list, then passes them to getSummary.
// Returns (normalizedScore, feedbackCount, error).
func (c *Client) GetReputationSummary(ctx context.Context, tokenID int64) (float64, int64, error) {
	if !c.hasReputation() {
		return 0, 0, nil
	}

	// The contract requires client addresses; fetch them first.
	clients, err := c.GetClients(ctx, tokenID)
	if err != nil || len(clients) == 0 {
		return 0, 0, nil
	}

	// ABI-encode: getSummary(uint256, address[], string, string)
	// Layout (32-byte slots after selector):
	//   [0] uint256 agentId
	//   [1] offset to address[] data  = 0x80 (128)
	//   [2] offset to string tag1     (dynamic, depends on address count)
	//   [3] offset to string tag2     (dynamic)
	//   address[] length + elements
	//   tag1 length = 0
	//   tag2 length = 0
	addrDataSlots := 1 + int64(len(clients)) // length slot + address slots
	addrDataBytes := addrDataSlots * 32
	tag1Offset := 128 + addrDataBytes         // after head (128) + address array data
	tag2Offset := tag1Offset + 32             // tag1 length slot (0) + no data

	totalSlots := 4 + addrDataSlots + 2 // head(4) + addr data + tag1(1) + tag2(1)
	buf := make([]byte, 0, 4+totalSlots*32)
	buf = append(buf, selGetSummary...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(big.NewInt(128).Bytes(), 32)...)                  // offset to address[]
	buf = append(buf, common.LeftPadBytes(big.NewInt(tag1Offset).Bytes(), 32)...)            // offset to tag1
	buf = append(buf, common.LeftPadBytes(big.NewInt(tag2Offset).Bytes(), 32)...)            // offset to tag2
	buf = append(buf, common.LeftPadBytes(big.NewInt(int64(len(clients))).Bytes(), 32)...)   // address[] length
	for _, addr := range clients {
		buf = append(buf, common.LeftPadBytes(common.HexToAddress(addr).Bytes(), 32)...)
	}
	buf = append(buf, make([]byte, 32)...) // tag1 length = 0
	buf = append(buf, make([]byte, 32)...) // tag2 length = 0

	result, err := c.callReputation(ctx, buf)
	if err != nil {
		c.logger.Debug("getSummary call failed", zap.Int64("token_id", tokenID), zap.Error(err))
		return 0, 0, nil
	}
	if len(result) < 96 {
		return 0, 0, nil
	}

	// Decode: (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
	count := new(big.Int).SetBytes(result[:32]).Int64()

	valueBig := new(big.Int).SetBytes(result[32:64])
	if result[32]&0x80 != 0 { // signed int128
		max256 := new(big.Int).Lsh(big.NewInt(1), 256)
		valueBig.Sub(valueBig, max256)
	}

	decimals := int(result[95]) // last byte of 3rd 32-byte slot
	score := float64(valueBig.Int64())
	if decimals > 0 {
		score /= math.Pow(10, float64(decimals))
	}

	return score, count, nil
}

// GetClients calls getClients(agentId) and returns the list of client addresses.
func (c *Client) GetClients(ctx context.Context, tokenID int64) ([]string, error) {
	if !c.hasReputation() {
		return nil, nil
	}

	buf := make([]byte, 0, 4+32)
	buf = append(buf, selGetClients...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)

	result, err := c.callReputation(ctx, buf)
	if err != nil {
		c.logger.Debug("getClients call failed", zap.Int64("token_id", tokenID), zap.Error(err))
		return nil, nil
	}
	if len(result) < 64 {
		return nil, nil
	}

	// Dynamic array: offset (32) + length (32) + elements
	arrLen := new(big.Int).SetBytes(result[32:64]).Int64()
	if arrLen == 0 {
		return nil, nil
	}

	addrs := make([]string, 0, arrLen)
	for i := int64(0); i < arrLen; i++ {
		start := 64 + i*32
		if start+32 > int64(len(result)) {
			break
		}
		addr := common.BytesToAddress(result[start+12 : start+32])
		addrs = append(addrs, strings.ToLower(addr.Hex()))
	}
	return addrs, nil
}

// GetLastIndex calls getLastIndex(agentId, clientAddress) and returns the last feedback index.
func (c *Client) GetLastIndex(ctx context.Context, tokenID int64, clientAddr string) (int64, error) {
	if !c.hasReputation() {
		return 0, nil
	}

	addr := common.HexToAddress(clientAddr)
	buf := make([]byte, 0, 4+64)
	buf = append(buf, selGetLastIndex...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(addr.Bytes(), 32)...)

	result, err := c.callReputation(ctx, buf)
	if err != nil {
		return 0, nil
	}
	if len(result) < 32 {
		return 0, nil
	}

	return new(big.Int).SetBytes(result[:32]).Int64(), nil
}

// ReadFeedback calls readFeedback(agentId, clientAddress, feedbackIndex).
func (c *Client) ReadFeedback(ctx context.Context, tokenID int64, clientAddr string, feedbackIndex int64) (*Feedback, error) {
	if !c.hasReputation() {
		return nil, nil
	}

	addr := common.HexToAddress(clientAddr)
	buf := make([]byte, 0, 4+96)
	buf = append(buf, selReadFeedback...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(tokenID).Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(addr.Bytes(), 32)...)
	buf = append(buf, common.LeftPadBytes(new(big.Int).SetInt64(feedbackIndex).Bytes(), 32)...)

	result, err := c.callReputation(ctx, buf)
	if err != nil {
		return nil, nil
	}
	// Returns: (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)
	// Minimum: 5 head slots + dynamic string data
	if len(result) < 160 {
		return nil, nil
	}

	// Slot 0: int128 value
	valueBig := new(big.Int).SetBytes(result[:32])
	if result[0]&0x80 != 0 {
		max256 := new(big.Int).Lsh(big.NewInt(1), 256)
		valueBig.Sub(valueBig, max256)
	}

	// Slot 1: uint8 valueDecimals
	decimals := int(result[63])

	val := float64(valueBig.Int64())
	if decimals > 0 {
		val /= math.Pow(10, float64(decimals))
	}

	// Slot 2: offset to tag1 string
	tag1Offset := new(big.Int).SetBytes(result[64:96]).Int64()
	tag1 := decodeABIString(result, tag1Offset)

	// Slot 3: offset to tag2 string
	tag2Offset := new(big.Int).SetBytes(result[96:128]).Int64()
	tag2 := decodeABIString(result, tag2Offset)

	// Slot 4: bool isRevoked
	isRevoked := result[159] != 0

	return &Feedback{
		ClientAddress: strings.ToLower(common.HexToAddress(clientAddr).Hex()),
		FeedbackIndex: feedbackIndex,
		Value:         val,
		Tag1:          tag1,
		Tag2:          tag2,
		IsRevoked:     isRevoked,
	}, nil
}

// ReadRecentFeedbacks fetches the most recent feedbacks for an agent.
func (c *Client) ReadRecentFeedbacks(ctx context.Context, tokenID int64, maxCount int) ([]Feedback, error) {
	if !c.hasReputation() {
		return nil, nil
	}

	clients, err := c.GetClients(ctx, tokenID)
	if err != nil || len(clients) == 0 {
		return nil, nil
	}

	// Collect (client, lastIndex) pairs.
	type entry struct {
		addr      string
		lastIndex int64
	}
	var entries []entry
	for _, addr := range clients {
		idx, err := c.GetLastIndex(ctx, tokenID, addr)
		if err != nil || idx == 0 {
			continue
		}
		entries = append(entries, entry{addr: addr, lastIndex: idx})
	}

	// Fetch recent feedbacks (iterate backwards from lastIndex per client).
	var feedbacks []Feedback
	for _, e := range entries {
		for idx := e.lastIndex; idx >= 1 && len(feedbacks) < maxCount; idx-- {
			fb, err := c.ReadFeedback(ctx, tokenID, e.addr, idx)
			if err != nil || fb == nil {
				break
			}
			feedbacks = append(feedbacks, *fb)
		}
		if len(feedbacks) >= maxCount {
			break
		}
	}

	return feedbacks, nil
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

// decodeABIString reads a dynamic string from ABI-encoded result at the given byte offset.
func decodeABIString(data []byte, offset int64) string {
	if offset+32 > int64(len(data)) {
		return ""
	}
	strLen := new(big.Int).SetBytes(data[offset : offset+32]).Int64()
	if strLen == 0 || offset+32+strLen > int64(len(data)) {
		return ""
	}
	return string(data[offset+32 : offset+32+strLen])
}
