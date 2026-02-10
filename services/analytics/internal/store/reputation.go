package store

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// AgentReview represents a peer review submitted for an agent.
type AgentReview struct {
	ID         uuid.UUID `json:"id"`
	AgentID    uuid.UUID `json:"agent_id"`
	ReviewerID string    `json:"reviewer_id"`
	Score      int       `json:"score"`
	Tags       []string  `json:"tags"`
	Comment    string    `json:"comment"`
	CreatedAt  time.Time `json:"created_at"`
}

// ReputationBreakdown holds the computed trust score components.
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

// InsertAgentReview inserts a peer review. Returns error on dedup violation.
func (s *Store) InsertAgentReview(ctx context.Context, review *AgentReview) error {
	if review.Tags == nil {
		review.Tags = []string{}
	}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO agent_reviews (agent_id, reviewer_id, score, tags, comment)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, review.AgentID, review.ReviewerID, review.Score, review.Tags, review.Comment).
		Scan(&review.ID, &review.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert agent review: %w", err)
	}
	return nil
}

// GetAgentReviews returns paginated reviews for an agent, ordered by newest first.
func (s *Store) GetAgentReviews(ctx context.Context, agentDBID uuid.UUID, limit, offset int) ([]AgentReview, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM agent_reviews WHERE agent_id = $1
	`, agentDBID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count reviews: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, reviewer_id, score, tags, comment, created_at
		FROM agent_reviews
		WHERE agent_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, agentDBID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("get reviews: %w", err)
	}
	defer rows.Close()

	var reviews []AgentReview
	for rows.Next() {
		var r AgentReview
		if err := rows.Scan(&r.ID, &r.AgentID, &r.ReviewerID, &r.Score, &r.Tags, &r.Comment, &r.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan review: %w", err)
		}
		reviews = append(reviews, r)
	}
	if reviews == nil {
		reviews = []AgentReview{}
	}

	return reviews, total, nil
}

// GetAverageReviewScore returns the average score and count of reviews for an agent.
func (s *Store) GetAverageReviewScore(ctx context.Context, agentDBID uuid.UUID) (float64, int, error) {
	var avg float64
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(score), 0), COUNT(*)
		FROM agent_reviews
		WHERE agent_id = $1
	`, agentDBID).Scan(&avg, &count)
	if err != nil {
		return 0, 0, fmt.Errorf("get average review score: %w", err)
	}
	return avg, count, nil
}

// UpsertReputationBreakdown inserts or updates the reputation breakdown for an agent.
func (s *Store) UpsertReputationBreakdown(ctx context.Context, rb *ReputationBreakdown) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO reputation_breakdown (
			agent_id, reliability, performance, activity, revenue_quality,
			customer_retention, peer_review, onchain_score, total_score,
			onchain_count, review_count, calculated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
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
			calculated_at      = NOW()
	`, rb.AgentID, rb.Reliability, rb.Performance, rb.Activity, rb.RevenueQuality,
		rb.CustomerRetention, rb.PeerReview, rb.OnchainScore, rb.TotalScore,
		rb.OnchainCount, rb.ReviewCount)
	if err != nil {
		return fmt.Errorf("upsert reputation breakdown: %w", err)
	}
	return nil
}

// GetReputationBreakdown returns the cached reputation breakdown for an agent.
func (s *Store) GetReputationBreakdown(ctx context.Context, agentDBID uuid.UUID) (*ReputationBreakdown, error) {
	rb := &ReputationBreakdown{}
	err := s.pool.QueryRow(ctx, `
		SELECT agent_id, reliability, performance, activity, revenue_quality,
			customer_retention, peer_review, onchain_score, total_score,
			onchain_count, review_count, calculated_at
		FROM reputation_breakdown
		WHERE agent_id = $1
	`, agentDBID).Scan(
		&rb.AgentID, &rb.Reliability, &rb.Performance, &rb.Activity, &rb.RevenueQuality,
		&rb.CustomerRetention, &rb.PeerReview, &rb.OnchainScore, &rb.TotalScore,
		&rb.OnchainCount, &rb.ReviewCount, &rb.CalculatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get reputation breakdown: %w", err)
	}
	return rb, nil
}

// UpdateReputationScore sets the reputation_score on the agents table.
func (s *Store) UpdateReputationScore(ctx context.Context, agentDBID uuid.UUID, score float64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET reputation_score = $2, updated_at = NOW() WHERE id = $1
	`, agentDBID, score)
	if err != nil {
		return fmt.Errorf("update reputation score: %w", err)
	}
	return nil
}

// GetActiveAgentIDs returns DB IDs of all active agents.
func (s *Store) GetActiveAgentIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM agents WHERE status = 'active'`)
	if err != nil {
		return nil, fmt.Errorf("get active agent ids: %w", err)
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

// GetAgentRequestConsistency computes an activity consistency score (0-100).
func (s *Store) GetAgentRequestConsistency(ctx context.Context, agentDBID uuid.UUID, days int) (float64, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT d::date AS day, COALESCE(cnt, 0) AS requests
		FROM generate_series(CURRENT_DATE - $2 * INTERVAL '1 day', CURRENT_DATE, '1 day') d
		LEFT JOIN (
			SELECT created_at::date AS day, COUNT(*) AS cnt
			FROM request_logs
			WHERE agent_id = $1
			  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
			GROUP BY created_at::date
		) rl ON rl.day = d::date
		ORDER BY d
	`, agentDBID, days)
	if err != nil {
		return 0, fmt.Errorf("get request consistency: %w", err)
	}
	defer rows.Close()

	var counts []float64
	for rows.Next() {
		var day time.Time
		var cnt float64
		if err := rows.Scan(&day, &cnt); err != nil {
			return 0, fmt.Errorf("scan daily count: %w", err)
		}
		counts = append(counts, cnt)
	}

	if len(counts) == 0 {
		return 0, nil
	}

	var sum float64
	for _, c := range counts {
		sum += c
	}
	mean := sum / float64(len(counts))
	if mean == 0 {
		return 0, nil
	}

	var variance float64
	for _, c := range counts {
		variance += (c - mean) * (c - mean)
	}
	variance /= float64(len(counts))
	stddev := math.Sqrt(variance)
	cv := stddev / mean
	score := math.Max(0, 100*(1-cv/2))
	volumeBonus := math.Min(50, math.Log10(mean+1)*25)
	score = math.Min(100, score*0.6+volumeBonus*0.4)

	return score, nil
}

// GetAgentPaymentSuccessRate returns the ratio of successful x402 payments (0-1).
func (s *Store) GetAgentPaymentSuccessRate(ctx context.Context, agentDBID uuid.UUID, days int) (float64, error) {
	var successCount, totalCount int64
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE x402_amount IS NOT NULL AND status_code < 400),
			COUNT(*) FILTER (WHERE x402_amount IS NOT NULL)
		FROM request_logs
		WHERE agent_id = $1
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
	`, agentDBID, days).Scan(&successCount, &totalCount)
	if err != nil {
		return 0, fmt.Errorf("get payment success rate: %w", err)
	}
	if totalCount == 0 {
		return 1.0, nil
	}
	return float64(successCount) / float64(totalCount), nil
}

// GetAgentErrorRateForDays returns the error rate for an agent over N days.
func (s *Store) GetAgentErrorRateForDays(ctx context.Context, agentDBID uuid.UUID, days int) (float64, error) {
	var errorCount, totalCount int64
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status_code >= 400),
			COUNT(*)
		FROM request_logs
		WHERE agent_id = $1
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
	`, agentDBID, days).Scan(&errorCount, &totalCount)
	if err != nil {
		return 0, fmt.Errorf("get agent error rate: %w", err)
	}
	if totalCount == 0 {
		return 0, nil
	}
	return float64(errorCount) / float64(totalCount), nil
}

// GetAgentAvgLatency returns the average response time in ms over N days.
func (s *Store) GetAgentAvgLatency(ctx context.Context, agentDBID uuid.UUID, days int) (float64, error) {
	var avg float64
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(response_ms), 0)
		FROM request_logs
		WHERE agent_id = $1
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
	`, agentDBID, days).Scan(&avg)
	if err != nil {
		return 0, fmt.Errorf("get agent avg latency: %w", err)
	}
	return avg, nil
}

// GetAgentReturningCustomerRate returns the ratio of customers with >1 request (0-1).
func (s *Store) GetAgentReturningCustomerRate(ctx context.Context, agentDBID uuid.UUID) (float64, error) {
	var returning, total int64
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE total_requests > 1),
			COUNT(*)
		FROM customers
		WHERE agent_id = $1
	`, agentDBID).Scan(&returning, &total)
	if err != nil {
		return 0, fmt.Errorf("get returning customer rate: %w", err)
	}
	if total == 0 {
		return 0, nil
	}
	return float64(returning) / float64(total), nil
}
