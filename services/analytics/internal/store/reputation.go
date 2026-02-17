package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ReputationBreakdown holds the component scores for an agent's reputation.
type ReputationBreakdown struct {
	AgentID           uuid.UUID `json:"agent_id"`
	Reliability       float64   `json:"reliability"`
	Performance       float64   `json:"performance"`
	Activity          float64   `json:"activity"`
	RevenueQuality    float64   `json:"revenue_quality"`
	CustomerRetention float64   `json:"customer_retention"`
	PeerReview        float64   `json:"peer_review"`
	OnchainScore      float64   `json:"onchain_score"`
	TotalScore        float64   `json:"total_score"`
	OnchainCount      int       `json:"onchain_count"`
	ReviewCount       int       `json:"review_count"`
	CalculatedAt      time.Time `json:"calculated_at"`
}

// UpsertReputationBreakdown inserts or updates a reputation breakdown record.
func (s *Store) UpsertReputationBreakdown(ctx context.Context, rb *ReputationBreakdown) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO reputation_breakdown (
			agent_id, reliability, performance, activity, revenue_quality,
			customer_retention, peer_review, onchain_score, total_score,
			onchain_count, review_count, calculated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (agent_id) DO UPDATE SET
			reliability        = EXCLUDED.reliability,
			performance        = EXCLUDED.performance,
			activity           = EXCLUDED.activity,
			revenue_quality    = EXCLUDED.revenue_quality,
			customer_retention = EXCLUDED.customer_retention,
			peer_review        = EXCLUDED.peer_review,
			onchain_score      = EXCLUDED.onchain_score,
			total_score        = EXCLUDED.total_score,
			onchain_count      = EXCLUDED.onchain_count,
			review_count       = EXCLUDED.review_count,
			calculated_at      = EXCLUDED.calculated_at
	`, rb.AgentID, rb.Reliability, rb.Performance, rb.Activity, rb.RevenueQuality,
		rb.CustomerRetention, rb.PeerReview, rb.OnchainScore, rb.TotalScore,
		rb.OnchainCount, rb.ReviewCount, rb.CalculatedAt)
	if err != nil {
		return fmt.Errorf("upsert reputation breakdown: %w", err)
	}
	return nil
}

// UpdateAgentReputationScore updates the agents table reputation_score column.
func (s *Store) UpdateAgentReputationScore(ctx context.Context, agentID uuid.UUID, score float64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET reputation_score = $2, updated_at = NOW() WHERE id = $1
	`, agentID, score)
	if err != nil {
		return fmt.Errorf("update agent reputation score: %w", err)
	}
	return nil
}

// ListAllActiveAgentIDs returns all active agent database IDs.
func (s *Store) ListAllActiveAgentIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM agents WHERE status = 'active'`)
	if err != nil {
		return nil, fmt.Errorf("list active agent ids: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan agent id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// ReputationInputs holds raw data needed to calculate reputation sub-scores.
type ReputationInputs struct {
	// From request_logs (30-day window)
	TotalRequests int64
	ErrorRate     float64
	AvgResponseMs float64

	// From agents table
	TotalRevenueUSDC float64
	TotalCustomers   int

	// From customers table
	LowRiskCustomers int
	TotalCustomerRows int

	// From agent_reviews table
	AvgReviewScore float64
	ReviewCount    int

	// From network_agents (on-chain reputation via discovery service)
	OnchainScore float64
	OnchainCount int
}

// GetReputationInputs fetches all data needed for reputation calculation in a single method.
func (s *Store) GetReputationInputs(ctx context.Context, agentID uuid.UUID) (*ReputationInputs, error) {
	ri := &ReputationInputs{}

	// 1. Request stats (30-day window)
	_ = s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
	`, agentID).Scan(&ri.TotalRequests, &ri.ErrorRate, &ri.AvgResponseMs)

	// 2. Agent aggregate stats
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(total_revenue_usdc, 0), total_customers
		FROM agents WHERE id = $1
	`, agentID).Scan(&ri.TotalRevenueUSDC, &ri.TotalCustomers)

	// 3. Customer retention (churn_risk distribution)
	_ = s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE churn_risk = 'low') AS low_risk,
			COUNT(*) AS total
		FROM customers WHERE agent_id = $1
	`, agentID).Scan(&ri.LowRiskCustomers, &ri.TotalCustomerRows)

	// 4. Peer reviews average
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(score), 0), COUNT(*)
		FROM agent_reviews WHERE agent_id = $1
	`, agentID).Scan(&ri.AvgReviewScore, &ri.ReviewCount)

	// 5. On-chain reputation (from network_agents via discovery service)
	_ = s.pool.QueryRow(ctx, `
		SELECT COALESCE(na.reputation_score, 0), COALESCE(na.reputation_count, 0)
		FROM agents a
		JOIN network_agents na ON na.chain_id = a.chain_id AND na.token_id = a.erc8004_token_id
		WHERE a.id = $1 AND a.erc8004_token_id IS NOT NULL
	`, agentID).Scan(&ri.OnchainScore, &ri.OnchainCount)

	return ri, nil
}
