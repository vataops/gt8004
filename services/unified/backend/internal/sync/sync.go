package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/store"
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

var httpClient = &http.Client{Timeout: 10 * time.Second}

// Job periodically discovers all ERC-8004 tokens on-chain and upserts them
// into the network_agents table.
type Job struct {
	store    *store.Store
	registry *erc8004.Registry
	logger   *zap.Logger
	interval time.Duration
	stopCh   chan struct{}
}

// NewJob creates a new sync job.
func NewJob(s *store.Store, registry *erc8004.Registry, logger *zap.Logger, interval time.Duration) *Job {
	return &Job{
		store:    s,
		registry: registry,
		logger:   logger,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic sync loop in a background goroutine.
func (j *Job) Start() {
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
}

// Stop signals the sync job to stop.
func (j *Job) Stop() {
	close(j.stopCh)
}

// Sync discovers all tokens from all configured chains and upserts them.
// Each chain gets its own 5-minute context so one slow chain doesn't starve others.
func (j *Job) Sync() {
	for chainID, client := range j.registry.Clients() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		j.syncChain(ctx, chainID, client)
		cancel()
	}
}

func (j *Job) syncChain(ctx context.Context, chainID int, client *erc8004.Client) {
	tokens, err := client.DiscoverAllTokens(ctx)
	if err != nil {
		j.logger.Error("failed to discover tokens",
			zap.Int("chain_id", chainID),
			zap.Error(err),
		)
		return
	}

	// Use a fresh context for DB upserts — the discovery context may be nearly expired.
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer dbCancel()

	upserted := 0
	for _, t := range tokens {
		agent := &store.NetworkAgent{
			ChainID:      chainID,
			TokenID:      t.TokenID,
			OwnerAddress: t.OwnerAddress,
			AgentURI:     t.AgentURI,
		}

		// Fetch metadata from agentURI if available.
		if t.AgentURI != "" {
			j.fetchMetadata(agent)
		}

		if err := j.store.UpsertNetworkAgent(dbCtx, agent); err != nil {
			j.logger.Warn("failed to upsert network agent",
				zap.Int("chain_id", chainID),
				zap.Int64("token_id", t.TokenID),
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

// fetchMetadata resolves the tokenURI and parses the ERC-8004 registration JSON.
// Supports both data:application/json;base64,... URIs and regular HTTP(S) URLs.
func (j *Job) fetchMetadata(agent *store.NetworkAgent) {
	uri := agent.AgentURI

	var body []byte

	switch {
	case strings.HasPrefix(uri, "data:application/json;base64,"):
		b64 := strings.TrimPrefix(uri, "data:application/json;base64,")
		var err error
		body, err = base64.StdEncoding.DecodeString(b64)
		if err != nil {
			j.logger.Debug("failed to decode base64 data URI", zap.Int64("token_id", agent.TokenID), zap.Error(err))
			return
		}

	case strings.HasPrefix(uri, "http://") || strings.HasPrefix(uri, "https://"):
		resp, err := httpClient.Get(uri)
		if err != nil {
			j.logger.Debug("failed to fetch agentURI", zap.String("uri", uri), zap.Error(err))
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return
		}
		body, err = io.ReadAll(io.LimitReader(resp.Body, 512*1024))
		if err != nil {
			return
		}

	default:
		return
	}

	var meta agentMeta
	if err := json.Unmarshal(body, &meta); err != nil {
		j.logger.Debug("failed to parse agentURI JSON", zap.Int64("token_id", agent.TokenID), zap.Error(err))
		return
	}

	agent.Name = meta.Name
	agent.Description = meta.Description
	agent.ImageURL = meta.Image
	agent.Metadata = json.RawMessage(body)
}
