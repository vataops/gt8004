package sync

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/erc8004"
	"github.com/GT8004/gt8004/internal/store"
)

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
