package erc8004

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"sync"
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
	deployBlock    uint64
	resolveWorkers int
	logger         *zap.Logger

	ethClient      *ethclient.Client
	contractAddr   common.Address
	reputationAddr common.Address
}

// Config holds configuration for the ERC-8004 client.
type Config struct {
	ChainID        int
	RegistryAddr   string
	ReputationAddr string
	RegistryRPC    string
	DeployBlock    uint64 // block number at which the registry was deployed; scan starts here
	ResolveWorkers int    // concurrent goroutines for ownership+URI resolution (default 10)
}

// OwnedToken represents a single ERC-8004 token owned by an address.
type OwnedToken struct {
	TokenID  int64  `json:"token_id"`
	AgentURI string `json:"agent_uri"`
}

// Function selectors (first 4 bytes of keccak256 of function signature)
var (
	selectorOwnerOf  = crypto.Keccak256([]byte("ownerOf(uint256)"))[:4]
	selectorTokenURI = crypto.Keccak256([]byte("tokenURI(uint256)"))[:4]

	// Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
	topicTransfer = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))
)

func NewClient(cfg Config, logger *zap.Logger) *Client {
	resolveWorkers := cfg.ResolveWorkers
	if resolveWorkers <= 0 {
		resolveWorkers = 10
	}
	c := &Client{
		chainID:        cfg.ChainID,
		registryAddr:   cfg.RegistryAddr,
		registryRPC:    cfg.RegistryRPC,
		deployBlock:    cfg.DeployBlock,
		resolveWorkers: resolveWorkers,
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
			if cfg.ReputationAddr != "" {
				c.reputationAddr = common.HexToAddress(cfg.ReputationAddr)
			}
			logger.Info("ERC-8004 ethclient connected",
				zap.String("registry", cfg.RegistryAddr),
				zap.String("reputation", cfg.ReputationAddr),
				zap.String("rpc", cfg.RegistryRPC))
		}
	}

	return c
}

// VerifyOwnership calls ownerOf(tokenId) on the ERC-8004 registry contract.
func (c *Client) VerifyOwnership(ctx context.Context, tokenID int64) (string, error) {
	if c.ethClient == nil {
		return "", fmt.Errorf("ethclient not initialised")
	}

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

	addr := common.BytesToAddress(result[12:32])
	if addr == (common.Address{}) {
		return "", fmt.Errorf("token %d does not exist (zero owner)", tokenID)
	}

	return strings.ToLower(addr.Hex()), nil
}

// GetAgentURI calls tokenURI(tokenId) on the ERC-8004 registry contract.
func (c *Client) GetAgentURI(ctx context.Context, tokenID int64) (string, error) {
	if c.ethClient == nil {
		return "", fmt.Errorf("ethclient not initialised")
	}

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

	if len(result) < 64 {
		return "", fmt.Errorf("getAgentURI returned invalid data (len=%d)", len(result))
	}

	offsetBig := new(big.Int).SetBytes(result[:32])
	offset := int(offsetBig.Int64())
	if offset+32 > len(result) {
		return "", fmt.Errorf("getAgentURI: offset out of bounds")
	}

	strLenBig := new(big.Int).SetBytes(result[offset : offset+32])
	strLen := int(strLenBig.Int64())
	if offset+32+strLen > len(result) {
		return "", fmt.Errorf("getAgentURI: string data out of bounds")
	}

	uri := string(result[offset+32 : offset+32+strLen])
	return uri, nil
}

// MintEvent represents a mint log with its block number.
type MintEvent struct {
	TokenID        int64
	BlockNumber    uint64
	CreatorAddress string
	TxHash         string
}

// DiscoveredToken represents an ERC-8004 token discovered on-chain.
type DiscoveredToken struct {
	TokenID        int64     `json:"token_id"`
	OwnerAddress   string    `json:"owner_address"`
	AgentURI       string    `json:"agent_uri"`
	MintedAt       time.Time `json:"minted_at"`
	CreatorAddress string    `json:"creator_address"`
	CreatedTx      string    `json:"created_tx"`
}

// CurrentBlock returns the latest block number from the chain.
func (c *Client) CurrentBlock(ctx context.Context) (uint64, error) {
	if c.ethClient == nil {
		return 0, fmt.Errorf("ethclient not initialised")
	}
	return c.ethClient.BlockNumber(ctx)
}

// scanMintLogs scans mint events from startBlock to endBlock using chunked queries.
func (c *Client) scanMintLogs(ctx context.Context, startBlock, endBlock uint64) ([]MintEvent, error) {
	// Try full-range query first
	fromBig := new(big.Int).SetUint64(startBlock)
	toBig := new(big.Int).SetUint64(endBlock)
	candidates, err := c.filterMintLogs(ctx, fromBig, toBig)
	if err == nil {
		return candidates, nil
	}

	// Fall back to chunked scan
	c.logger.Info("full-range query failed, chunking", zap.Uint64("from", startBlock), zap.Uint64("to", endBlock), zap.Error(err))
	// L2 chains (Base etc.) have faster blocks, so use smaller chunks to avoid RPC timeouts
	var chunkSize uint64 = 49999
	if c.chainID == 8453 || c.chainID == 84532 {
		chunkSize = 5000
	}
	candidates = nil
	seen := make(map[int64]bool)

	addEvents := func(events []MintEvent) {
		for _, ev := range events {
			if !seen[ev.TokenID] {
				seen[ev.TokenID] = true
				candidates = append(candidates, ev)
			}
		}
	}

	for from := startBlock; from <= endBlock; from += chunkSize {
		end := from + chunkSize - 1
		if end > endBlock {
			end = endBlock
		}
		events, chunkErr := c.scanChunkWithRetry(ctx, from, end, 3)
		if chunkErr != nil {
			// Subdivide failed chunk into smaller sub-chunks and retry
			subEvents := c.subdivideAndRetry(ctx, from, end, chunkSize, seen)
			addEvents(subEvents)
			continue
		}
		addEvents(events)
	}
	return candidates, nil
}

// scanChunkWithRetry attempts to fetch mint logs for a block range with retries.
func (c *Client) scanChunkWithRetry(ctx context.Context, from, end uint64, maxRetries int) ([]MintEvent, error) {
	var events []MintEvent
	var err error
	for attempt := 0; attempt < maxRetries; attempt++ {
		events, err = c.filterMintLogs(ctx, new(big.Int).SetUint64(from), new(big.Int).SetUint64(end))
		if err == nil {
			return events, nil
		}
		c.logger.Warn("chunk mint scan failed, retrying",
			zap.Uint64("from", from), zap.Uint64("to", end),
			zap.Int("attempt", attempt+1), zap.Error(err))
		time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
	}
	return nil, err
}

// subdivideAndRetry splits a failed block range into smaller sub-chunks and retries each.
// Progressively reduces chunk size: chunkSize/10 → chunkSize/100 (minimum 200 blocks).
func (c *Client) subdivideAndRetry(ctx context.Context, from, end, parentChunkSize uint64, seen map[int64]bool) []MintEvent {
	subSize := parentChunkSize / 10
	if subSize < 200 {
		subSize = 200
	}
	c.logger.Info("subdividing failed chunk",
		zap.Uint64("from", from), zap.Uint64("to", end),
		zap.Uint64("sub_chunk_size", subSize))

	var result []MintEvent
	for sf := from; sf <= end; sf += subSize {
		se := sf + subSize - 1
		if se > end {
			se = end
		}
		events, err := c.scanChunkWithRetry(ctx, sf, se, 3)
		if err != nil {
			// Try even smaller sub-chunks as last resort
			microSize := subSize / 10
			if microSize >= 200 {
				c.logger.Warn("sub-chunk failed, trying micro-chunks",
					zap.Uint64("from", sf), zap.Uint64("to", se),
					zap.Uint64("micro_size", microSize))
				for mf := sf; mf <= se; mf += microSize {
					me := mf + microSize - 1
					if me > se {
						me = se
					}
					mEvents, mErr := c.scanChunkWithRetry(ctx, mf, me, 2)
					if mErr != nil {
						c.logger.Error("micro-chunk scan failed, skipping",
							zap.Uint64("from", mf), zap.Uint64("to", me), zap.Error(mErr))
						continue
					}
					for _, ev := range mEvents {
						if !seen[ev.TokenID] {
							result = append(result, ev)
						}
					}
				}
			} else {
				c.logger.Error("sub-chunk scan failed, skipping",
					zap.Uint64("from", sf), zap.Uint64("to", se), zap.Error(err))
			}
			continue
		}
		for _, ev := range events {
			if !seen[ev.TokenID] {
				result = append(result, ev)
			}
		}
	}
	return result
}

// DiscoverAllTokens scans mint events (Transfer from zero address) to find
// all tokens ever minted, then verifies current ownership and fetches agentURI.
func (c *Client) DiscoverAllTokens(ctx context.Context) ([]DiscoveredToken, error) {
	if c.ethClient == nil {
		return nil, fmt.Errorf("ethclient not initialised")
	}

	currentBlock, err := c.ethClient.BlockNumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get block number: %w", err)
	}

	startBlock := c.deployBlock
	if startBlock == 0 {
		// Fallback: scan last 500k blocks if deploy block is unknown
		if currentBlock > 500000 {
			startBlock = currentBlock - 500000
		}
	}

	c.logger.Info("full token scan",
		zap.Int("chain_id", c.chainID),
		zap.Uint64("start_block", startBlock),
		zap.Uint64("current_block", currentBlock),
		zap.Uint64("range", currentBlock-startBlock),
	)

	candidates, err := c.scanMintLogs(ctx, startBlock, currentBlock)
	if err != nil {
		return nil, err
	}

	return c.resolveTokens(ctx, candidates), nil
}

// DiscoverNewTokens scans only new mint events from fromBlock to the current block.
// Much faster than DiscoverAllTokens for incremental updates.
func (c *Client) DiscoverNewTokens(ctx context.Context, fromBlock uint64) ([]DiscoveredToken, uint64, error) {
	if c.ethClient == nil {
		return nil, 0, fmt.Errorf("ethclient not initialised")
	}

	currentBlock, err := c.ethClient.BlockNumber(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get block number: %w", err)
	}

	if fromBlock >= currentBlock {
		return nil, currentBlock, nil
	}

	candidates, err := c.scanMintLogs(ctx, fromBlock, currentBlock)
	if err != nil {
		return nil, 0, err
	}

	if len(candidates) == 0 {
		return nil, currentBlock, nil
	}

	tokens := c.resolveTokens(ctx, candidates)
	return tokens, currentBlock, nil
}

// resolveTokens verifies ownership and fetches agentURI for mint events.
// For large batches (>500 tokens), uses "lite" mode: saves tokens directly
// from mint event data without per-token RPC calls to avoid rate limiting.
// Ownership and agentURI are fetched gradually in subsequent incremental syncs.
func (c *Client) resolveTokens(ctx context.Context, candidates []MintEvent) []DiscoveredToken {
	// For large batches, skip per-token RPC calls to avoid rate limits.
	// Use mint event data directly (creator as owner, empty agentURI).
	if len(candidates) > 500 {
		c.logger.Info("large batch: using lite resolve (mint data only)",
			zap.Int("chain_id", c.chainID),
			zap.Int("count", len(candidates)),
		)
		return c.resolveTokensLite(ctx, candidates)
	}

	return c.resolveTokensFull(ctx, candidates)
}

// resolveTokensLite converts mint events to tokens using only mint data.
// No per-token RPC calls (ownerOf, tokenURI) are made.
func (c *Client) resolveTokensLite(ctx context.Context, candidates []MintEvent) []DiscoveredToken {
	tokens := make([]DiscoveredToken, 0, len(candidates))
	for _, ev := range candidates {
		tokens = append(tokens, DiscoveredToken{
			TokenID:        ev.TokenID,
			OwnerAddress:   ev.CreatorAddress,
			AgentURI:       "",
			MintedAt:       time.Time{}, // will be set to now by upsert
			CreatorAddress: ev.CreatorAddress,
			CreatedTx:      ev.TxHash,
		})
	}
	return tokens
}

// resolveTokensFull verifies ownership and fetches agentURI for each token.
// Used for small batches (incremental syncs).
func (c *Client) resolveTokensFull(ctx context.Context, candidates []MintEvent) []DiscoveredToken {
	// Fetch block timestamps
	blockNums := make(map[uint64]bool)
	mintBlocks := make(map[int64]uint64)
	mintCreators := make(map[int64]string)
	mintTxHashes := make(map[int64]string)
	for _, ev := range candidates {
		blockNums[ev.BlockNumber] = true
		mintBlocks[ev.TokenID] = ev.BlockNumber
		mintCreators[ev.TokenID] = ev.CreatorAddress
		mintTxHashes[ev.TokenID] = ev.TxHash
	}

	headerCtx, headerCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer headerCancel()

	blockTimestamps := make(map[uint64]time.Time)
	var headerMu sync.Mutex
	var headerWg sync.WaitGroup
	headerSem := make(chan struct{}, 10)
	for bn := range blockNums {
		headerWg.Add(1)
		go func(blockNum uint64) {
			defer headerWg.Done()
			headerSem <- struct{}{}
			defer func() { <-headerSem }()
			header, err := c.ethClient.HeaderByNumber(headerCtx, new(big.Int).SetUint64(blockNum))
			if err != nil {
				return
			}
			headerMu.Lock()
			blockTimestamps[blockNum] = time.Unix(int64(header.Time), 0)
			headerMu.Unlock()
		}(bn)
	}
	headerWg.Wait()

	// Verify current owner and get agentURI
	verifyCtx, verifyCancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer verifyCancel()

	tokens := make([]DiscoveredToken, 0, len(candidates))
	var tokensMu sync.Mutex
	var verifyWg sync.WaitGroup
	verifySem := make(chan struct{}, c.resolveWorkers)
	for _, ev := range candidates {
		verifyWg.Add(1)
		go func(mint MintEvent) {
			defer verifyWg.Done()
			verifySem <- struct{}{}
			defer func() { <-verifySem }()
			var owner string
			var err error
			for attempt := 0; attempt < 3; attempt++ {
				owner, err = c.VerifyOwnership(verifyCtx, mint.TokenID)
				if err == nil {
					break
				}
				time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			}
			if err != nil {
				c.logger.Warn("ownership verification failed after retries, dropping token",
					zap.Int64("token_id", mint.TokenID), zap.Error(err))
				return
			}
			agentURI, _ := c.GetAgentURI(verifyCtx, mint.TokenID)
			tokensMu.Lock()
			tokens = append(tokens, DiscoveredToken{
				TokenID:        mint.TokenID,
				OwnerAddress:   owner,
				AgentURI:       agentURI,
				MintedAt:       blockTimestamps[mintBlocks[mint.TokenID]],
				CreatorAddress: mintCreators[mint.TokenID],
				CreatedTx:      mintTxHashes[mint.TokenID],
			})
			tokensMu.Unlock()
		}(ev)
	}
	verifyWg.Wait()

	return tokens
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
			creator := strings.ToLower(common.BytesToAddress(log.Topics[2].Bytes()).Hex())
			events = append(events, MintEvent{
				TokenID:        tid,
				BlockNumber:    log.BlockNumber,
				CreatorAddress: creator,
				TxHash:         log.TxHash.Hex(),
			})
		}
	}
	return events, nil
}

// ChainID returns the chain ID this client is connected to.
func (c *Client) ChainID() int { return c.chainID }

// Registry manages ERC-8004 clients for multiple chains.
type Registry struct {
	clients map[int]*Client
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

// Clients returns all registered clients for iteration.
func (r *Registry) Clients() map[int]*Client {
	return r.clients
}
