package erc8004

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"
)

// Client manages ERC-8004 identity and reputation registry interactions.
type Client struct {
	chainID        int
	registryAddr   string
	registryRPC    string
	gt8004TokenID  int64
	gt8004AgentURI string
	logger         *zap.Logger

	ethClient    *ethclient.Client
	contractAddr common.Address
}

// Config holds configuration for the ERC-8004 client.
type Config struct {
	ChainID        int
	RegistryAddr   string
	RegistryRPC    string
	GT8004TokenID  int64
	GT8004AgentURI string
}

// OwnedToken represents a single ERC-8004 token owned by an address.
type OwnedToken struct {
	TokenID  int64  `json:"token_id"`
	AgentURI string `json:"agent_uri"`
}

// Function selectors (first 4 bytes of keccak256 of function signature)
var (
	selectorOwnerOf     = crypto.Keccak256([]byte("ownerOf(uint256)"))[:4]
	selectorTokenURI = crypto.Keccak256([]byte("tokenURI(uint256)"))[:4]

	// Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
	topicTransfer = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))
)

func NewClient(cfg Config, logger *zap.Logger) *Client {
	c := &Client{
		chainID:        cfg.ChainID,
		registryAddr:   cfg.RegistryAddr,
		registryRPC:    cfg.RegistryRPC,
		gt8004TokenID:  cfg.GT8004TokenID,
		gt8004AgentURI: cfg.GT8004AgentURI,
		logger:         logger,
	}

	if cfg.RegistryRPC != "" && cfg.RegistryAddr != "" {
		ec, err := ethclient.Dial(cfg.RegistryRPC)
		if err != nil {
			logger.Error("failed to connect to registry RPC, on-chain calls will fail",
				zap.Error(err), zap.String("rpc", cfg.RegistryRPC))
		} else {
			c.ethClient = ec
			c.contractAddr = common.HexToAddress(cfg.RegistryAddr)
			logger.Info("ERC-8004 ethclient connected",
				zap.String("registry", cfg.RegistryAddr),
				zap.String("rpc", cfg.RegistryRPC))
		}
	}

	return c
}

// RegistryAddr returns the configured registry contract address.
func (c *Client) RegistryAddr() string { return c.registryAddr }

// VerifyOwnership calls ownerOf(tokenId) on the ERC-8004 registry contract
// and returns the owner address as a hex string.
func (c *Client) VerifyOwnership(ctx context.Context, tokenID int64) (string, error) {
	if c.ethClient == nil {
		return "", fmt.Errorf("ethclient not initialised")
	}

	// ABI-encode: selector + uint256(tokenID)
	tokenIDBig := new(big.Int).SetInt64(tokenID)
	paddedTokenID := common.LeftPadBytes(tokenIDBig.Bytes(), 32)
	data := append(selectorOwnerOf, paddedTokenID...)

	msg := ethereum.CallMsg{
		To:   &c.contractAddr,
		Data: data,
	}

	result, err := c.ethClient.CallContract(ctx, msg, nil)
	if err != nil {
		return "", fmt.Errorf("ownerOf call failed: %w", err)
	}

	if len(result) < 32 {
		return "", fmt.Errorf("ownerOf returned invalid data (len=%d)", len(result))
	}

	// The return value is an ABI-encoded address (32 bytes, left-padded)
	addr := common.BytesToAddress(result[12:32])
	if addr == (common.Address{}) {
		return "", fmt.Errorf("token %d does not exist (zero owner)", tokenID)
	}

	return strings.ToLower(addr.Hex()), nil
}

// GetAgentURI calls getAgentURI(tokenId) on the ERC-8004 registry contract
// and returns the agent URI string.
func (c *Client) GetAgentURI(ctx context.Context, tokenID int64) (string, error) {
	if c.ethClient == nil {
		return "", fmt.Errorf("ethclient not initialised")
	}

	// ABI-encode: selector + uint256(tokenID)
	tokenIDBig := new(big.Int).SetInt64(tokenID)
	paddedTokenID := common.LeftPadBytes(tokenIDBig.Bytes(), 32)
	data := append(selectorTokenURI, paddedTokenID...)

	msg := ethereum.CallMsg{
		To:   &c.contractAddr,
		Data: data,
	}

	result, err := c.ethClient.CallContract(ctx, msg, nil)
	if err != nil {
		return "", fmt.Errorf("getAgentURI call failed: %w", err)
	}

	// ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
	if len(result) < 64 {
		return "", fmt.Errorf("getAgentURI returned invalid data (len=%d)", len(result))
	}

	// Read the offset (should be 32 for a single return value)
	offsetBig := new(big.Int).SetBytes(result[:32])
	offset := int(offsetBig.Int64())
	if offset+32 > len(result) {
		return "", fmt.Errorf("getAgentURI: offset out of bounds")
	}

	// Read the string length
	strLenBig := new(big.Int).SetBytes(result[offset : offset+32])
	strLen := int(strLenBig.Int64())
	if offset+32+strLen > len(result) {
		return "", fmt.Errorf("getAgentURI: string data out of bounds")
	}

	uri := string(result[offset+32 : offset+32+strLen])
	return uri, nil
}

// GetTokensByOwner scans Transfer events to find tokens received by ownerAddr,
// then verifies current ownership with ownerOf(). This works with contracts
// that do NOT implement ERC721Enumerable.
func (c *Client) GetTokensByOwner(ctx context.Context, ownerAddr string) ([]OwnedToken, error) {
	if c.ethClient == nil {
		return nil, fmt.Errorf("ethclient not initialised")
	}

	addr := common.HexToAddress(ownerAddr)
	paddedTo := common.BytesToHash(common.LeftPadBytes(addr.Bytes(), 32))

	// Try full-range query first (fastest: single RPC call)
	candidateIDs, err := c.filterTransferLogs(ctx, paddedTo, nil, nil)
	if err != nil {
		// Fallback: chunked scanning for RPCs with block range limits
		c.logger.Info("full-range log query failed, falling back to chunked scan", zap.Error(err))
		currentBlock, blockErr := c.ethClient.BlockNumber(ctx)
		if blockErr != nil {
			return nil, fmt.Errorf("failed to get block number: %w", blockErr)
		}

		const chunkSize uint64 = 49999
		var startBlock uint64
		if currentBlock > 2000000 {
			startBlock = currentBlock - 2000000
		}

		candidateIDs = nil
		seen := make(map[int64]bool)
		for from := startBlock; from <= currentBlock; from += chunkSize {
			end := from + chunkSize - 1
			if end > currentBlock {
				end = currentBlock
			}
			fromBig := new(big.Int).SetUint64(from)
			endBig := new(big.Int).SetUint64(end)
			ids, chunkErr := c.filterTransferLogs(ctx, paddedTo, fromBig, endBig)
			if chunkErr != nil {
				c.logger.Warn("chunk scan failed, skipping",
					zap.Uint64("from", from), zap.Uint64("to", end), zap.Error(chunkErr))
				continue
			}
			for _, tid := range ids {
				if !seen[tid] {
					seen[tid] = true
					candidateIDs = append(candidateIDs, tid)
				}
			}
		}
	}

	// Verify current ownership and fetch agent URI
	ownerLower := strings.ToLower(addr.Hex())
	tokens := make([]OwnedToken, 0, len(candidateIDs))
	for _, tid := range candidateIDs {
		currentOwner, err := c.VerifyOwnership(ctx, tid)
		if err != nil || currentOwner != ownerLower {
			continue
		}
		agentURI, _ := c.GetAgentURI(ctx, tid)
		tokens = append(tokens, OwnedToken{
			TokenID:  tid,
			AgentURI: agentURI,
		})
	}

	return tokens, nil
}

// filterTransferLogs queries Transfer event logs for tokens sent to a specific address.
func (c *Client) filterTransferLogs(ctx context.Context, paddedTo common.Hash, fromBlock, toBlock *big.Int) ([]int64, error) {
	query := ethereum.FilterQuery{
		FromBlock: fromBlock,
		ToBlock:   toBlock,
		Addresses: []common.Address{c.contractAddr},
		Topics:    [][]common.Hash{{topicTransfer}, nil, {paddedTo}},
	}
	logs, err := c.ethClient.FilterLogs(ctx, query)
	if err != nil {
		return nil, err
	}

	seen := make(map[int64]bool)
	var ids []int64
	for _, log := range logs {
		if len(log.Topics) < 4 {
			continue
		}
		tokenID := new(big.Int).SetBytes(log.Topics[3].Bytes())
		tid := tokenID.Int64()
		if !seen[tid] {
			seen[tid] = true
			ids = append(ids, tid)
		}
	}
	return ids, nil
}

// MintEvent represents a mint log with its block number.
type MintEvent struct {
	TokenID     int64
	BlockNumber uint64
}

// DiscoveredToken represents an ERC-8004 token discovered on-chain.
type DiscoveredToken struct {
	TokenID      int64     `json:"token_id"`
	OwnerAddress string    `json:"owner_address"`
	AgentURI     string    `json:"agent_uri"`
	MintedAt     time.Time `json:"minted_at"`
}

// DiscoverAllTokens scans mint events (Transfer from zero address) to find
// all tokens ever minted, then verifies current ownership and fetches agentURI.
func (c *Client) DiscoverAllTokens(ctx context.Context) ([]DiscoveredToken, error) {
	if c.ethClient == nil {
		return nil, fmt.Errorf("ethclient not initialised")
	}

	// Scan Transfer events from zero address (= mints)
	candidates, err := c.filterMintLogs(ctx, nil, nil)
	if err != nil {
		c.logger.Info("full-range mint log query failed, falling back to chunked scan", zap.Error(err))
		currentBlock, blockErr := c.ethClient.BlockNumber(ctx)
		if blockErr != nil {
			return nil, fmt.Errorf("failed to get block number: %w", blockErr)
		}

		const chunkSize uint64 = 49999
		var startBlock uint64
		if currentBlock > 2000000 {
			startBlock = currentBlock - 2000000
		}

		candidates = nil
		seen := make(map[int64]bool)
		for from := startBlock; from <= currentBlock; from += chunkSize {
			end := from + chunkSize - 1
			if end > currentBlock {
				end = currentBlock
			}
			fromBig := new(big.Int).SetUint64(from)
			endBig := new(big.Int).SetUint64(end)
			events, chunkErr := c.filterMintLogs(ctx, fromBig, endBig)
			if chunkErr != nil {
				c.logger.Warn("chunk mint scan failed, skipping",
					zap.Uint64("from", from), zap.Uint64("to", end), zap.Error(chunkErr))
				continue
			}
			for _, ev := range events {
				if !seen[ev.TokenID] {
					seen[ev.TokenID] = true
					candidates = append(candidates, ev)
				}
			}
		}
	}

	// Fetch block timestamps for mint blocks
	blockNums := make(map[uint64]bool)
	mintBlocks := make(map[int64]uint64) // tokenID → blockNumber
	for _, ev := range candidates {
		blockNums[ev.BlockNumber] = true
		mintBlocks[ev.TokenID] = ev.BlockNumber
	}

	blockTimestamps := make(map[uint64]time.Time)
	for bn := range blockNums {
		header, err := c.ethClient.HeaderByNumber(ctx, new(big.Int).SetUint64(bn))
		if err != nil {
			c.logger.Warn("failed to fetch block header", zap.Uint64("block", bn), zap.Error(err))
			continue
		}
		blockTimestamps[bn] = time.Unix(int64(header.Time), 0)
	}

	// For each candidate, verify current owner and get agentURI
	tokens := make([]DiscoveredToken, 0, len(candidates))
	for _, ev := range candidates {
		owner, err := c.VerifyOwnership(ctx, ev.TokenID)
		if err != nil {
			continue // token may have been burned
		}
		agentURI, _ := c.GetAgentURI(ctx, ev.TokenID)
		tokens = append(tokens, DiscoveredToken{
			TokenID:      ev.TokenID,
			OwnerAddress: owner,
			AgentURI:     agentURI,
			MintedAt:     blockTimestamps[mintBlocks[ev.TokenID]],
		})
	}

	return tokens, nil
}

// filterMintLogs queries Transfer event logs from the zero address (mints).
func (c *Client) filterMintLogs(ctx context.Context, fromBlock, toBlock *big.Int) ([]MintEvent, error) {
	zeroHash := common.BytesToHash(common.LeftPadBytes(common.Address{}.Bytes(), 32))
	query := ethereum.FilterQuery{
		FromBlock: fromBlock,
		ToBlock:   toBlock,
		Addresses: []common.Address{c.contractAddr},
		Topics:    [][]common.Hash{{topicTransfer}, {zeroHash}},
	}
	logs, err := c.ethClient.FilterLogs(ctx, query)
	if err != nil {
		return nil, err
	}

	seen := make(map[int64]bool)
	var events []MintEvent
	for _, log := range logs {
		if len(log.Topics) < 4 {
			continue
		}
		tokenID := new(big.Int).SetBytes(log.Topics[3].Bytes())
		tid := tokenID.Int64()
		if !seen[tid] {
			seen[tid] = true
			events = append(events, MintEvent{TokenID: tid, BlockNumber: log.BlockNumber})
		}
	}
	return events, nil
}

// ChainID returns the chain ID this client is connected to.
func (c *Client) ChainID() int { return c.chainID }

// Registry manages ERC-8004 clients for multiple chains.
type Registry struct {
	clients map[int]*Client // chainID → Client
	logger  *zap.Logger
}

// NewRegistry creates a Registry with one Client per supported network.
func NewRegistry(networks map[int]Config, logger *zap.Logger) *Registry {
	r := &Registry{
		clients: make(map[int]*Client, len(networks)),
		logger:  logger,
	}
	for chainID, cfg := range networks {
		r.clients[chainID] = NewClient(cfg, logger)
	}
	return r
}

// GetClient returns the ERC-8004 client for the given chain ID.
func (r *Registry) GetClient(chainID int) (*Client, error) {
	c, ok := r.clients[chainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain_id: %d", chainID)
	}
	return c, nil
}

// Default returns the first available client (for backward compatibility).
func (r *Registry) Default() *Client {
	for _, c := range r.clients {
		return c
	}
	return nil
}

// Clients returns all registered clients for iteration.
func (r *Registry) Clients() map[int]*Client {
	return r.clients
}

