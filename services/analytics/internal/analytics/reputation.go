package analytics

import (
	"context"
	"math"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// ReputationCalculator periodically computes composite reputation scores
// from multiple data sources and writes them to the reputation_breakdown table.
type ReputationCalculator struct {
	store    *store.Store
	logger   *zap.Logger
	interval time.Duration
	stopCh   chan struct{}
}

// NewReputationCalculator creates a new ReputationCalculator.
func NewReputationCalculator(s *store.Store, logger *zap.Logger, interval time.Duration) *ReputationCalculator {
	return &ReputationCalculator{
		store:    s,
		logger:   logger,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic reputation calculation loop in a background goroutine.
func (rc *ReputationCalculator) Start() {
	go func() {
		ticker := time.NewTicker(rc.interval)
		defer ticker.Stop()

		rc.logger.Info("reputation calculator started", zap.Duration("interval", rc.interval))

		rc.Calculate()

		for {
			select {
			case <-ticker.C:
				rc.Calculate()
			case <-rc.stopCh:
				rc.logger.Info("reputation calculator stopped")
				return
			}
		}
	}()
}

// Stop signals the reputation calculator to stop.
func (rc *ReputationCalculator) Stop() {
	close(rc.stopCh)
}

// Weights for each reputation component (must sum to 1.0).
const (
	weightReliability       = 0.20
	weightPerformance       = 0.15
	weightActivity          = 0.15
	weightRevenueQuality    = 0.15
	weightCustomerRetention = 0.10
	weightPeerReview        = 0.10
	weightOnchain           = 0.15
)

// Calculate computes reputation breakdowns for all active agents.
func (rc *ReputationCalculator) Calculate() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	agentIDs, err := rc.store.ListAllActiveAgentIDs(ctx)
	if err != nil {
		rc.logger.Error("failed to list active agents for reputation", zap.Error(err))
		return
	}

	if len(agentIDs) == 0 {
		return
	}

	now := time.Now().UTC()
	updated := 0

	for _, agentID := range agentIDs {
		inputs, err := rc.store.GetReputationInputs(ctx, agentID)
		if err != nil {
			rc.logger.Warn("failed to get reputation inputs",
				zap.String("agent_id", agentID.String()),
				zap.Error(err),
			)
			continue
		}

		rb := rc.computeBreakdown(agentID, inputs, now)

		if err := rc.store.UpsertReputationBreakdown(ctx, rb); err != nil {
			rc.logger.Warn("failed to upsert reputation breakdown",
				zap.String("agent_id", agentID.String()),
				zap.Error(err),
			)
			continue
		}

		if err := rc.store.UpdateAgentReputationScore(ctx, agentID, rb.TotalScore); err != nil {
			rc.logger.Warn("failed to update agent reputation score",
				zap.String("agent_id", agentID.String()),
				zap.Error(err),
			)
			continue
		}

		updated++
	}

	rc.logger.Info("reputation calculation complete",
		zap.Int("total_agents", len(agentIDs)),
		zap.Int("updated", updated),
	)
}

// computeBreakdown calculates all sub-scores and the weighted total.
func (rc *ReputationCalculator) computeBreakdown(agentID [16]byte, inputs *store.ReputationInputs, now time.Time) *store.ReputationBreakdown {
	// Reliability: (1 - error_rate) * 100 → 0-100
	reliability := (1 - inputs.ErrorRate) * 100

	// Performance: inverse of response time, capped at 0-100
	// 0ms → 100, 1000ms → 0
	performance := math.Max(0, 100-inputs.AvgResponseMs/10)

	// Activity: log-scaled request count → 0-100
	// ~1000 requests → ~100
	activity := 0.0
	if inputs.TotalRequests > 0 {
		activity = math.Min(100, math.Log2(float64(inputs.TotalRequests)+1)*10)
	}

	// Revenue Quality: log-scaled revenue → 0-100
	revenueQuality := 0.0
	if inputs.TotalRevenueUSDC > 0 {
		revenueQuality = math.Min(100, math.Log2(inputs.TotalRevenueUSDC+1)*15)
	}

	// Customer Retention: ratio of low-risk customers → 0-100
	customerRetention := 0.0
	if inputs.TotalCustomerRows > 0 {
		customerRetention = float64(inputs.LowRiskCustomers) / float64(inputs.TotalCustomerRows) * 100
	}

	// Peer Review: average score normalized to 0-100 (reviews are 1-5)
	peerReview := 0.0
	if inputs.ReviewCount > 0 {
		peerReview = inputs.AvgReviewScore / 5.0 * 100
	}

	// On-chain Score: use the raw score from the reputation registry.
	// On-chain scores are typically 0-100.
	onchainScore := math.Max(0, math.Min(100, inputs.OnchainScore))

	// Weighted total
	total := reliability*weightReliability +
		performance*weightPerformance +
		activity*weightActivity +
		revenueQuality*weightRevenueQuality +
		customerRetention*weightCustomerRetention +
		peerReview*weightPeerReview +
		onchainScore*weightOnchain

	return &store.ReputationBreakdown{
		AgentID:           agentID,
		Reliability:       math.Round(reliability*100) / 100,
		Performance:       math.Round(performance*100) / 100,
		Activity:          math.Round(activity*100) / 100,
		RevenueQuality:    math.Round(revenueQuality*100) / 100,
		CustomerRetention: math.Round(customerRetention*100) / 100,
		PeerReview:        math.Round(peerReview*100) / 100,
		OnchainScore:      math.Round(onchainScore*100) / 100,
		TotalScore:        math.Round(total*100) / 100,
		OnchainCount:      inputs.OnchainCount,
		ReviewCount:       inputs.ReviewCount,
		CalculatedAt:      now,
	}
}
