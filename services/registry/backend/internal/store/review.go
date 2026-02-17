package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AgentReview represents a peer review for an agent.
type AgentReview struct {
	ID         uuid.UUID `json:"id"`
	AgentID    uuid.UUID `json:"agent_id"`
	ReviewerID string    `json:"reviewer_id"`
	Score      int       `json:"score"`
	Tags       []string  `json:"tags"`
	Comment    string    `json:"comment"`
	CreatedAt  time.Time `json:"created_at"`
}

// InsertAgentReview creates a new peer review.
// Uses the dedup index (agent_id, reviewer_id, epoch_day) to prevent duplicate daily reviews.
func (s *Store) InsertAgentReview(ctx context.Context, review *AgentReview) error {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO agent_reviews (agent_id, reviewer_id, score, tags, comment)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, review.AgentID, review.ReviewerID, review.Score, review.Tags, review.Comment).Scan(&review.ID, &review.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert agent review: %w", err)
	}
	return nil
}

// ListAgentReviews returns paginated reviews for an agent.
func (s *Store) ListAgentReviews(ctx context.Context, agentID uuid.UUID, limit, offset int) ([]AgentReview, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM agent_reviews WHERE agent_id = $1`, agentID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count agent reviews: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, reviewer_id, score, tags, COALESCE(comment, ''), created_at
		FROM agent_reviews
		WHERE agent_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, agentID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list agent reviews: %w", err)
	}
	defer rows.Close()

	var reviews []AgentReview
	for rows.Next() {
		var r AgentReview
		if err := rows.Scan(&r.ID, &r.AgentID, &r.ReviewerID, &r.Score, &r.Tags, &r.Comment, &r.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan agent review: %w", err)
		}
		reviews = append(reviews, r)
	}
	if reviews == nil {
		reviews = []AgentReview{}
	}

	return reviews, total, nil
}

// GetAgentReviewSummary returns average score and total count for an agent.
func (s *Store) GetAgentReviewSummary(ctx context.Context, agentID uuid.UUID) (float64, int, error) {
	var avg float64
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(score), 0), COUNT(*)
		FROM agent_reviews WHERE agent_id = $1
	`, agentID).Scan(&avg, &count)
	if err != nil {
		return 0, 0, fmt.Errorf("get review summary: %w", err)
	}
	return avg, count, nil
}
