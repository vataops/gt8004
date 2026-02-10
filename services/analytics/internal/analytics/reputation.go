package analytics

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// ReputationCalculator periodically computes trust scores for all active agents.
// In the analytics microservice, on-chain reputation is not available (no go-ethereum).
// The unified service handles on-chain scoring; here we compute off-chain components only.
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

// Start begins the periodic reputation calculation loop.
func (rc *ReputationCalculator) Start() {
	go func() {
		ticker := time.NewTicker(rc.interval)
		defer ticker.Stop()

		rc.logger.Info("reputation calculator started", zap.Duration("interval", rc.interval))

		// Initial calculation on startup.
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

// Component weights for the trust score.
// On-chain weight (0.10) is redistributed to off-chain components in this service.
const (
	weightReliability       = 0.25
	weightPerformance       = 0.20
	weightActivity          = 0.15
	weightRevenueQuality    = 0.10
	weightCustomerRetention = 0.10
	weightPeerReview        = 0.10
	weightOnchain           = 0.10
)

// Calculate recomputes trust scores for all active agents.
func (rc *ReputationCalculator) Calculate() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	ids, err := rc.store.GetActiveAgentIDs(ctx)
	if err != nil {
		rc.logger.Error("failed to get active agent ids", zap.Error(err))
		return
	}

	if len(ids) == 0 {
		return
	}

	updated := 0
	for _, agentDBID := range ids {
		if err := rc.calculateAgent(ctx, agentDBID); err != nil {
			rc.logger.Warn("failed to calculate reputation",
				zap.String("agent_id", agentDBID.String()),
				zap.Error(err),
			)
			continue
		}
		updated++
	}

	rc.logger.Debug("reputation calculation complete",
		zap.Int("agents", len(ids)),
		zap.Int("updated", updated),
	)
}

func (rc *ReputationCalculator) calculateAgent(ctx context.Context, agentDBID uuid.UUID) error {
	const days = 30

	// 1. Reliability: (1 - errorRate) * 100
	errorRate, err := rc.store.GetAgentErrorRateForDays(ctx, agentDBID, days)
	if err != nil {
		errorRate = 0
	}
	reliability := (1 - errorRate) * 100

	// 2. Performance: latency-based score (200ms=100, 5000ms=0)
	avgLatency, err := rc.store.GetAgentAvgLatency(ctx, agentDBID, days)
	if err != nil {
		avgLatency = 0
	}
	performance := math.Max(0, math.Min(100, 100-(avgLatency-200)*(100.0/4800.0)))

	// 3. Activity: request consistency
	activity, err := rc.store.GetAgentRequestConsistency(ctx, agentDBID, days)
	if err != nil {
		activity = 0
	}

	// 4. Revenue quality: payment success rate
	paymentRate, err := rc.store.GetAgentPaymentSuccessRate(ctx, agentDBID, days)
	if err != nil {
		paymentRate = 1.0
	}
	revenueQuality := paymentRate * 100

	// 5. Customer retention: returning customer ratio
	retentionRate, err := rc.store.GetAgentReturningCustomerRate(ctx, agentDBID)
	if err != nil {
		retentionRate = 0
	}
	customerRetention := retentionRate * 100

	// 6. Peer review: average score mapped 1-5 → 0-100
	avgReviewScore, reviewCount, err := rc.store.GetAverageReviewScore(ctx, agentDBID)
	if err != nil {
		avgReviewScore = 0
		reviewCount = 0
	}
	var peerReview float64
	if reviewCount > 0 {
		peerReview = (avgReviewScore - 1) * 25 // 1→0, 5→100
		if reviewCount < 3 {
			peerReview *= float64(reviewCount) / 3.0
		}
	}

	// 7. On-chain: not available in analytics microservice — skip and redistribute weight
	// Redistribute on-chain weight proportionally to off-chain components
	scale := 1.0 / (1.0 - weightOnchain)
	totalScore := (reliability*weightReliability +
		performance*weightPerformance +
		activity*weightActivity +
		revenueQuality*weightRevenueQuality +
		customerRetention*weightCustomerRetention +
		peerReview*weightPeerReview) * scale

	// Clamp to 0-100
	totalScore = math.Max(0, math.Min(100, totalScore))

	// Upsert breakdown
	rb := &store.ReputationBreakdown{
		AgentID:           agentDBID,
		Reliability:       reliability,
		Performance:       performance,
		Activity:          activity,
		RevenueQuality:    revenueQuality,
		CustomerRetention: customerRetention,
		PeerReview:        peerReview,
		OnchainScore:      0, // not available in analytics service
		TotalScore:        totalScore,
		OnchainCount:      0,
		ReviewCount:       reviewCount,
	}
	if err := rc.store.UpsertReputationBreakdown(ctx, rb); err != nil {
		return err
	}

	// Update agent.reputation_score
	return rc.store.UpdateReputationScore(ctx, agentDBID, totalScore)
}
