package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004-discovery/internal/erc8004"
	"github.com/GT8004/gt8004-discovery/internal/store"
)

// agentMeta is the JSON schema returned by an ERC-8004 agentURI.
type agentMeta struct {
	Type           string        `json:"type"`
	Name           string        `json:"name"`
	Description    string        `json:"description"`
	Image          string        `json:"image"`
	Services       []interface{} `json:"services"`
	X402Support    interface{}   `json:"x402Support"`
	Active         interface{}   `json:"active"`
	Registrations  []interface{} `json:"registrations"`
	SupportedTrust []interface{} `json:"supportedTrust"`
}

var httpClient = &http.Client{Timeout: 15 * time.Second}

// ipfsGateways is a list of public IPFS gateways to try in order.
var ipfsGateways = []string{
	"https://w3s.link/ipfs/",
	"https://dweb.link/ipfs/",
	"https://cloudflare-ipfs.com/ipfs/",
	"https://ipfs.io/ipfs/",
}

// JobConfig holds tuning parameters for the sync job.
type JobConfig struct {
	BackfillInterval  time.Duration
	BackfillWorkers   int
	BackfillBatchSize int
	ReputationInterval time.Duration
}

// Job periodically discovers all ERC-8004 tokens on-chain and upserts them
// into the network_agents table.
type Job struct {
	store    *store.Store
	registry *erc8004.Registry
	logger   *zap.Logger
	interval time.Duration
	stopCh   chan struct{}

	backfillInterval  time.Duration
	backfillWorkers   int
	backfillBatchSize int
	reputationInterval time.Duration
}

// NewJob creates a new sync job.
func NewJob(s *store.Store, registry *erc8004.Registry, logger *zap.Logger, interval time.Duration, jcfg JobConfig) *Job {
	return &Job{
		store:              s,
		registry:           registry,
		logger:             logger,
		interval:           interval,
		stopCh:             make(chan struct{}),
		backfillInterval:   jcfg.BackfillInterval,
		backfillWorkers:    jcfg.BackfillWorkers,
		backfillBatchSize:  jcfg.BackfillBatchSize,
		reputationInterval: jcfg.ReputationInterval,
	}
}

// Start begins the periodic sync loop, backfill loop, and reputation loop in background goroutines.
func (j *Job) Start() {
	// Main sync loop (full scan + backfill only, reputation separated).
	go func() {
		ticker := time.NewTicker(j.interval)
		defer ticker.Stop()

		j.logger.Info("network agent sync started", zap.Duration("interval", j.interval))

		// Initial sync on startup.
		j.Sync()

		for {
			select {
			case <-ticker.C:
				j.Sync()
			case <-j.stopCh:
				j.logger.Info("network agent sync stopped")
				return
			}
		}
	}()

	// Dedicated backfill loop — runs on configurable interval to populate missing metadata.
	go func() {
		// Wait a bit before the first backfill-only pass so the initial full
		// sync can finish its own backfill pass first.
		select {
		case <-time.After(3 * time.Minute):
		case <-j.stopCh:
			return
		}

		ticker := time.NewTicker(j.backfillInterval)
		defer ticker.Stop()

		j.logger.Info("backfill loop started", zap.Duration("interval", j.backfillInterval))

		for {
			select {
			case <-ticker.C:
				j.BackfillAll()
			case <-j.stopCh:
				j.logger.Info("backfill loop stopped")
				return
			}
		}
	}()

	// Dedicated reputation refresh loop — separate from main sync to reduce RPC load.
	go func() {
		// Wait for initial sync to complete before first reputation pass.
		select {
		case <-time.After(5 * time.Minute):
		case <-j.stopCh:
			return
		}

		ticker := time.NewTicker(j.reputationInterval)
		defer ticker.Stop()

		j.logger.Info("reputation loop started", zap.Duration("interval", j.reputationInterval))

		for {
			select {
			case <-ticker.C:
				j.RefreshAllReputation()
			case <-j.stopCh:
				j.logger.Info("reputation loop stopped")
				return
			}
		}
	}()
}

// BackfillAll runs backfill for all configured chains.
func (j *Job) BackfillAll() {
	for chainID, client := range j.registry.Clients() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		j.backfillAgentURIs(ctx, chainID, client)
		cancel()
	}
}

// RefreshAllReputation refreshes reputation scores for all configured chains.
func (j *Job) RefreshAllReputation() {
	for chainID, client := range j.registry.Clients() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		j.refreshReputation(ctx, chainID, client)
		cancel()
	}
}

// Stop signals the sync job to stop.
func (j *Job) Stop() {
	close(j.stopCh)
}

// SyncSingleToken fetches on-chain data for a single token and upserts it.
// Used for immediate sync after registration (bypasses periodic scan interval).
func (j *Job) SyncSingleToken(ctx context.Context, chainID int, tokenID int64) error {
	client, err := j.registry.GetClient(chainID)
	if err != nil {
		return fmt.Errorf("unsupported chain_id %d: %w", chainID, err)
	}

	owner, err := client.VerifyOwnership(ctx, tokenID)
	if err != nil {
		return fmt.Errorf("verify ownership: %w", err)
	}

	agentURI, _ := client.GetAgentURI(ctx, tokenID)

	agent := &store.NetworkAgent{
		ChainID:      chainID,
		TokenID:      tokenID,
		OwnerAddress: owner,
		AgentURI:     agentURI,
	}

	if agentURI != "" {
		j.fetchMetadata(agent)
	}

	score, count, repErr := client.GetReputationSummary(ctx, tokenID)
	if repErr == nil && count > 0 {
		agent.ReputationScore = score
		agent.ReputationCount = int(count)
	}

	existing, existErr := j.store.GetNetworkAgent(ctx, chainID, tokenID)
	if existErr != nil {
		newVal, _ := json.Marshal(map[string]interface{}{
			"owner_address": agent.OwnerAddress,
			"agent_uri":     agent.AgentURI,
			"name":          agent.Name,
		})
		_ = j.store.InsertNetworkAgentHistory(ctx, chainID, tokenID, "created", nil, newVal)
	} else {
		j.recordChanges(ctx, existing, agent)
	}

	if err := j.store.UpsertNetworkAgent(ctx, agent); err != nil {
		return fmt.Errorf("upsert network agent: %w", err)
	}

	j.logger.Info("single token synced",
		zap.Int("chain_id", chainID),
		zap.Int64("token_id", tokenID),
		zap.String("name", agent.Name),
	)
	return nil
}

// Sync discovers new tokens from all configured chains and upserts them.
// Uses incremental scanning: only scans blocks after the last synced block.
// Falls back to full scan on the first run (no sync state).
func (j *Job) Sync() {
	for chainID, client := range j.registry.Clients() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
		j.syncChain(ctx, chainID, client)
		cancel()
	}
}

func (j *Job) syncChain(ctx context.Context, chainID int, client *erc8004.Client) {
	lastBlock, err := j.store.GetLastSyncedBlock(ctx, chainID)
	if err != nil {
		j.logger.Error("failed to get last synced block",
			zap.Int("chain_id", chainID),
			zap.Error(err),
		)
		return
	}

	var tokens []erc8004.DiscoveredToken
	var scannedTo uint64

	if lastBlock == 0 {
		// First sync: full scan
		j.logger.Info("first sync, performing full scan", zap.Int("chain_id", chainID))
		tokens, err = client.DiscoverAllTokens(ctx)
		if err != nil {
			j.logger.Error("failed to discover tokens",
				zap.Int("chain_id", chainID),
				zap.Error(err),
			)
			return
		}
		scannedTo, err = client.CurrentBlock(ctx)
		if err != nil {
			j.logger.Error("failed to get current block", zap.Int("chain_id", chainID), zap.Error(err))
			return
		}
	} else {
		// Incremental sync: only scan new blocks
		tokens, scannedTo, err = client.DiscoverNewTokens(ctx, lastBlock+1)
		if err != nil {
			j.logger.Error("failed to discover new tokens",
				zap.Int("chain_id", chainID),
				zap.Uint64("from_block", lastBlock+1),
				zap.Error(err),
			)
			return
		}
		j.logger.Info("incremental scan complete",
			zap.Int("chain_id", chainID),
			zap.Uint64("from_block", lastBlock+1),
			zap.Uint64("to_block", scannedTo),
			zap.Int("new_tokens", len(tokens)),
		)
	}

	j.upsertTokens(ctx, chainID, tokens)

	// Backfill agentURI for tokens saved without metadata (from lite resolve).
	j.backfillAgentURIs(ctx, chainID, client)

	// Reputation refresh runs on its own separate loop (see Start()).

	// Update sync state with a fresh context (the parent ctx may have expired
	// after the long metadata fetch + upsert phase).
	ssCtx, ssCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer ssCancel()
	if err := j.store.SetLastSyncedBlock(ssCtx, chainID, scannedTo); err != nil {
		j.logger.Error("failed to update sync state",
			zap.Int("chain_id", chainID),
			zap.Uint64("block", scannedTo),
			zap.Error(err),
		)
	}
}

// backfillAgentURIs fetches agentURI for tokens saved without metadata (from lite resolve).
// Processes up to 500 tokens per cycle using 5 concurrent workers.
func (j *Job) backfillAgentURIs(ctx context.Context, chainID int, client *erc8004.Client) {
	tokens, err := j.store.ListTokensMissingURI(ctx, chainID, j.backfillBatchSize)
	if err != nil {
		j.logger.Error("failed to list tokens missing URI", zap.Int("chain_id", chainID), zap.Error(err))
		return
	}
	if len(tokens) == 0 {
		return
	}

	j.logger.Info("backfilling agentURIs",
		zap.Int("chain_id", chainID),
		zap.Int("batch_size", len(tokens)),
	)

	fillCtx, fillCancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer fillCancel()

	var wg sync.WaitGroup
	sem := make(chan struct{}, j.backfillWorkers)
	filled := int64(0)

	for _, tokenID := range tokens {
		wg.Add(1)
		go func(tid int64) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// Small delay to stay under RPC rate limits.
			time.Sleep(100 * time.Millisecond)

			uri, err := client.GetAgentURI(fillCtx, tid)
			if err != nil || uri == "" {
				return
			}

			owner, ownerErr := client.VerifyOwnership(fillCtx, tid)

			agent := &store.NetworkAgent{
				ChainID:  chainID,
				TokenID:  tid,
				AgentURI: uri,
			}
			if ownerErr == nil {
				agent.OwnerAddress = owner
			}

			j.fetchMetadata(agent)

			if err := j.store.UpdateAgentURI(fillCtx, chainID, tid, uri, agent.Name, agent.Description, agent.ImageURL, agent.Metadata, owner); err != nil {
				j.logger.Warn("failed to update agent URI", zap.Int64("token_id", tid), zap.Error(err))
				return
			}
			atomic.AddInt64(&filled, 1)
		}(tokenID)
	}
	wg.Wait()

	j.logger.Info("backfill complete",
		zap.Int("chain_id", chainID),
		zap.Int64("filled", filled),
		zap.Int("batch_size", len(tokens)),
	)
}

// refreshReputation fetches on-chain reputation for all existing agents on a chain.
func (j *Job) refreshReputation(ctx context.Context, chainID int, client *erc8004.Client) {
	tokenIDs, err := j.store.ListTokenIDsByChain(ctx, chainID)
	if err != nil {
		j.logger.Error("failed to list tokens for reputation refresh", zap.Int("chain_id", chainID), zap.Error(err))
		return
	}
	if len(tokenIDs) == 0 {
		return
	}

	repCtx, repCancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer repCancel()

	var wg sync.WaitGroup
	sem := make(chan struct{}, j.backfillWorkers)
	updated := int64(0)
	for _, tid := range tokenIDs {
		wg.Add(1)
		go func(tokenID int64) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			score, count, err := client.GetReputationSummary(repCtx, tokenID)
			if err != nil || count == 0 {
				return
			}
			if dbErr := j.store.UpdateNetworkAgentReputation(repCtx, chainID, tokenID, score, int(count)); dbErr != nil {
				j.logger.Warn("failed to update reputation", zap.Int64("token_id", tokenID), zap.Error(dbErr))
				return
			}
			atomic.AddInt64(&updated, 1)
		}(tid)
	}
	wg.Wait()

	j.logger.Info("reputation refresh complete",
		zap.Int("chain_id", chainID),
		zap.Int("total_agents", len(tokenIDs)),
		zap.Int64("updated", updated),
	)
}

// upsertTokens converts discovered tokens to network agents, fetches metadata, and upserts them.
func (j *Job) upsertTokens(ctx context.Context, chainID int, tokens []erc8004.DiscoveredToken) {
	if len(tokens) == 0 {
		return
	}

	// Build agents list and fetch metadata concurrently (10 workers).
	agents := make([]*store.NetworkAgent, len(tokens))
	for i, t := range tokens {
		agents[i] = &store.NetworkAgent{
			ChainID:        chainID,
			TokenID:        t.TokenID,
			OwnerAddress:   t.OwnerAddress,
			AgentURI:       t.AgentURI,
			CreatorAddress: t.CreatorAddress,
			CreatedTx:      t.CreatedTx,
			CreatedAt:      t.MintedAt,
		}
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, 10)
	for _, agent := range agents {
		if agent.AgentURI == "" {
			continue
		}
		wg.Add(1)
		go func(a *store.NetworkAgent) {
			defer wg.Done()
			sem <- struct{}{}
			j.fetchMetadata(a)
			<-sem
		}(agent)
	}
	wg.Wait()

	// Log metadata fetch results.
	withMeta := 0
	for _, a := range agents {
		if a.Name != "" {
			withMeta++
		}
	}
	j.logger.Info("metadata fetch complete",
		zap.Int("chain_id", chainID),
		zap.Int("total", len(agents)),
		zap.Int("with_metadata", withMeta),
	)

	// Fetch on-chain reputation scores concurrently.
	client, _ := j.registry.GetClient(chainID)
	if client != nil {
		repCtx, repCancel := context.WithTimeout(context.Background(), 5*time.Minute)
		var repWg sync.WaitGroup
		repSem := make(chan struct{}, 5)
		for _, agent := range agents {
			repWg.Add(1)
			go func(a *store.NetworkAgent) {
				defer repWg.Done()
				repSem <- struct{}{}
				defer func() { <-repSem }()
				score, count, err := client.GetReputationSummary(repCtx, a.TokenID)
				if err == nil && count > 0 {
					a.ReputationScore = score
					a.ReputationCount = int(count)
				}
			}(agent)
		}
		repWg.Wait()
		repCancel()

		withRep := 0
		for _, a := range agents {
			if a.ReputationCount > 0 {
				withRep++
			}
		}
		j.logger.Info("reputation fetch complete",
			zap.Int("chain_id", chainID),
			zap.Int("with_reputation", withRep),
		)
	}

	// Upsert all agents with fresh DB context and change tracking.
	// 30 minutes to handle 25k+ individual upserts on first full scan.
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer dbCancel()

	upserted := 0
	for _, agent := range agents {
		// Fetch existing record for change detection
		existing, err := j.store.GetNetworkAgent(dbCtx, agent.ChainID, agent.TokenID)
		if err != nil {
			// Agent doesn't exist yet — record creation event
			newVal, _ := json.Marshal(map[string]interface{}{
				"owner_address": agent.OwnerAddress,
				"agent_uri":     agent.AgentURI,
				"name":          agent.Name,
			})
			if histErr := j.store.InsertNetworkAgentHistory(dbCtx, agent.ChainID, agent.TokenID, "created", nil, newVal); histErr != nil {
				j.logger.Warn("failed to record creation event", zap.Error(histErr))
			}
		} else {
			// Detect and record changes
			j.recordChanges(dbCtx, existing, agent)
		}

		if err := j.store.UpsertNetworkAgent(dbCtx, agent); err != nil {
			j.logger.Warn("failed to upsert network agent",
				zap.Int("chain_id", chainID),
				zap.Int64("token_id", agent.TokenID),
				zap.Error(err),
			)
			continue
		}
		upserted++
	}

	j.logger.Info("synced network agents",
		zap.Int("chain_id", chainID),
		zap.Int("discovered", len(tokens)),
		zap.Int("upserted", upserted),
	)
}

// fetchMetadata resolves the agentURI and parses the ERC-8004 registration JSON.
func (j *Job) fetchMetadata(agent *store.NetworkAgent) {
	uri := agent.AgentURI

	var body []byte

	switch {
	case strings.HasPrefix(uri, "data:application/json;base64,"):
		b64 := strings.TrimPrefix(uri, "data:application/json;base64,")
		var err error
		body, err = base64.StdEncoding.DecodeString(b64)
		if err != nil {
			body = []byte(b64)
		}

	case strings.HasPrefix(uri, "data:application/json,"):
		raw := strings.TrimPrefix(uri, "data:application/json,")
		body = []byte(raw)

	case strings.HasPrefix(uri, "ipfs://"):
		cid := strings.TrimPrefix(uri, "ipfs://")
		body = j.ipfsFetch(cid)
		if body == nil {
			j.logger.Debug("ipfs fetch failed", zap.Int64("token_id", agent.TokenID), zap.String("cid", cid))
			return
		}

	case strings.HasPrefix(uri, "http://") || strings.HasPrefix(uri, "https://"):
		body = j.httpFetch(uri)
		if body == nil {
			j.logger.Debug("http fetch failed", zap.Int64("token_id", agent.TokenID), zap.String("uri", uri))
			return
		}

	default:
		if len(uri) > 2 && uri[0] == '{' {
			body = []byte(uri)
		} else {
			return
		}
	}

	var meta agentMeta
	if err := json.Unmarshal(body, &meta); err != nil {
		j.logger.Debug("metadata json parse failed", zap.Int64("token_id", agent.TokenID), zap.Error(err))
		return
	}

	agent.Name = meta.Name
	agent.Description = meta.Description
	agent.ImageURL = meta.Image
	agent.Metadata = json.RawMessage(body)
}

// ipfsFetch tries multiple IPFS gateways in order until one succeeds.
func (j *Job) ipfsFetch(cid string) []byte {
	for _, gw := range ipfsGateways {
		if body := j.httpFetch(gw + cid); body != nil {
			return body
		}
	}
	return nil
}

func (j *Job) httpFetch(url string) []byte {
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return nil
	}
	return body
}

// recordChanges compares old and new agent data and inserts history records for any changes.
func (j *Job) recordChanges(ctx context.Context, old *store.NetworkAgent, newAgent *store.NetworkAgent) {
	// Ownership change
	if old.OwnerAddress != newAgent.OwnerAddress && newAgent.OwnerAddress != "" {
		oldVal, _ := json.Marshal(map[string]string{"owner_address": old.OwnerAddress})
		newVal, _ := json.Marshal(map[string]string{"owner_address": newAgent.OwnerAddress})
		if err := j.store.InsertNetworkAgentHistory(ctx, newAgent.ChainID, newAgent.TokenID, "ownership", oldVal, newVal); err != nil {
			j.logger.Warn("failed to record ownership change", zap.Error(err))
		}
	}

	// URI change
	if old.AgentURI != newAgent.AgentURI && newAgent.AgentURI != "" {
		oldVal, _ := json.Marshal(map[string]string{"agent_uri": old.AgentURI})
		newVal, _ := json.Marshal(map[string]string{"agent_uri": newAgent.AgentURI})
		if err := j.store.InsertNetworkAgentHistory(ctx, newAgent.ChainID, newAgent.TokenID, "uri", oldVal, newVal); err != nil {
			j.logger.Warn("failed to record URI change", zap.Error(err))
		}
	}

	// Metadata change (name, description, or full metadata blob)
	if (newAgent.Name != "" && old.Name != newAgent.Name) ||
		(newAgent.Description != "" && old.Description != newAgent.Description) ||
		(len(newAgent.Metadata) > 2 && string(old.Metadata) != string(newAgent.Metadata)) {
		oldVal, _ := json.Marshal(map[string]interface{}{
			"name":        old.Name,
			"description": old.Description,
			"image_url":   old.ImageURL,
		})
		newVal, _ := json.Marshal(map[string]interface{}{
			"name":        newAgent.Name,
			"description": newAgent.Description,
			"image_url":   newAgent.ImageURL,
		})
		if err := j.store.InsertNetworkAgentHistory(ctx, newAgent.ChainID, newAgent.TokenID, "metadata", oldVal, newVal); err != nil {
			j.logger.Warn("failed to record metadata change", zap.Error(err))
		}
	}
}
