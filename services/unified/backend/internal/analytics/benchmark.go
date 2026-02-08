package analytics

import (
	"context"
	"math"
	"sort"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/store"
)

// BenchmarkCalculator periodically recalculates benchmark rankings for each agent category.
type BenchmarkCalculator struct {
	store    *store.Store
	logger   *zap.Logger
	interval time.Duration
	stopCh   chan struct{}
}

// NewBenchmarkCalculator creates a new BenchmarkCalculator.
func NewBenchmarkCalculator(s *store.Store, logger *zap.Logger, interval time.Duration) *BenchmarkCalculator {
	return &BenchmarkCalculator{
		store:    s,
		logger:   logger,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic benchmark recalculation loop in a background goroutine.
func (bc *BenchmarkCalculator) Start() {
	go func() {
		ticker := time.NewTicker(bc.interval)
		defer ticker.Stop()

		bc.logger.Info("benchmark calculator started", zap.Duration("interval", bc.interval))

		// Run an initial calculation on startup.
		bc.Calculate()

		for {
			select {
			case <-ticker.C:
				bc.Calculate()
			case <-bc.stopCh:
				bc.logger.Info("benchmark calculator stopped")
				return
			}
		}
	}()
}

// Stop signals the benchmark calculator to stop.
func (bc *BenchmarkCalculator) Stop() {
	close(bc.stopCh)
}

// agentScore holds intermediate scoring data for ranking.
type agentScore struct {
	agent store.Agent
	score float64
	errRate float64
}

// Calculate recalculates benchmark rankings for every distinct agent category.
func (bc *BenchmarkCalculator) Calculate() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	categories, err := bc.store.GetDistinctAgentCategories(ctx)
	if err != nil {
		bc.logger.Error("failed to get distinct agent categories", zap.Error(err))
		return
	}

	if len(categories) == 0 {
		bc.logger.Debug("no agent categories found, skipping benchmark calculation")
		return
	}

	bc.logger.Debug("calculating benchmarks", zap.Int("categories", len(categories)))

	for _, category := range categories {
		bc.calculateCategory(ctx, category)
	}
}

// calculateCategory computes benchmark scores and rankings for a single category.
func (bc *BenchmarkCalculator) calculateCategory(ctx context.Context, category string) {
	agents, err := bc.store.GetActiveAgentsByCategory(ctx, category)
	if err != nil {
		bc.logger.Error("failed to get agents for category",
			zap.String("category", category),
			zap.Error(err),
		)
		return
	}

	if len(agents) == 0 {
		return
	}

	// Calculate composite scores for each agent.
	scored := make([]agentScore, 0, len(agents))
	for _, agent := range agents {
		errRate, err := bc.store.GetAgentErrorRate(ctx, agent.ID)
		if err != nil {
			bc.logger.Warn("failed to get error rate for agent",
				zap.String("agent_id", agent.AgentID),
				zap.Error(err),
			)
			errRate = 0
		}

		// Composite score formula:
		//   score = (total_requests * 0.3) + ((1 - error_rate) * 100 * 0.3)
		//         + (customer_count * 0.2) + (max(0, 100 - avg_response_ms/10) * 0.2)
		requestScore := float64(agent.TotalRequests) * 0.3
		reliabilityScore := (1 - errRate) * 100 * 0.3
		customerScore := float64(agent.TotalCustomers) * 0.2
		latencyScore := math.Max(0, 100-agent.AvgResponseMs/10) * 0.2

		composite := requestScore + reliabilityScore + customerScore + latencyScore

		scored = append(scored, agentScore{
			agent:   agent,
			score:   composite,
			errRate: errRate,
		})
	}

	// Sort by score descending.
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	// Clear old entries for this category.
	if err := bc.store.ClearBenchmarkCategory(ctx, category); err != nil {
		bc.logger.Error("failed to clear benchmark category",
			zap.String("category", category),
			zap.Error(err),
		)
		return
	}

	// Upsert new ranked entries.
	now := time.Now().UTC()
	for rank, s := range scored {
		entry := &store.BenchmarkEntry{
			Category:      category,
			AgentID:       s.agent.ID,
			Rank:          rank + 1,
			Score:         s.score,
			TotalRequests: s.agent.TotalRequests,
			AvgResponseMs: s.agent.AvgResponseMs,
			ErrorRate:     s.errRate,
			Revenue:       s.agent.TotalRevenueUSDC,
			CustomerCount: s.agent.TotalCustomers,
			CalculatedAt:  now,
		}

		if err := bc.store.UpsertBenchmarkEntry(ctx, entry); err != nil {
			bc.logger.Error("failed to upsert benchmark entry",
				zap.String("category", category),
				zap.String("agent_id", s.agent.AgentID),
				zap.Error(err),
			)
		}
	}

	bc.logger.Debug("benchmark calculated for category",
		zap.String("category", category),
		zap.Int("agents_ranked", len(scored)),
	)
}
