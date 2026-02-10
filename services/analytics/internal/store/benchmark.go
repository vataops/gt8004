package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// BenchmarkEntry represents a single entry in the benchmark leaderboard.
type BenchmarkEntry struct {
	ID            uuid.UUID `json:"id"`
	Category      string    `json:"category"`
	AgentID       uuid.UUID `json:"agent_id"`
	AgentName     string    `json:"agent_name"`
	AgentStringID string    `json:"agent_string_id"`
	Rank          int       `json:"rank"`
	Score         float64   `json:"score"`
	TotalRequests int64     `json:"total_requests"`
	AvgResponseMs float64   `json:"avg_response_ms"`
	ErrorRate     float64   `json:"error_rate"`
	Revenue       float64   `json:"revenue"`
	CustomerCount int       `json:"customer_count"`
	CalculatedAt  time.Time `json:"calculated_at"`
}

// UpsertBenchmarkEntry inserts or updates a benchmark entry for a given category and agent.
func (s *Store) UpsertBenchmarkEntry(ctx context.Context, entry *BenchmarkEntry) error {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO benchmark_cache (
			category, agent_id, rank, score, total_requests,
			avg_response_ms, error_rate, revenue, customer_count, calculated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (category, agent_id) DO UPDATE SET
			rank = EXCLUDED.rank,
			score = EXCLUDED.score,
			total_requests = EXCLUDED.total_requests,
			avg_response_ms = EXCLUDED.avg_response_ms,
			error_rate = EXCLUDED.error_rate,
			revenue = EXCLUDED.revenue,
			customer_count = EXCLUDED.customer_count,
			calculated_at = EXCLUDED.calculated_at
		RETURNING id
	`,
		entry.Category, entry.AgentID, entry.Rank, entry.Score, entry.TotalRequests,
		entry.AvgResponseMs, entry.ErrorRate, entry.Revenue, entry.CustomerCount, entry.CalculatedAt,
	).Scan(&entry.ID)
	if err != nil {
		return fmt.Errorf("upsert benchmark entry: %w", err)
	}
	return nil
}

// GetBenchmarkByCategory returns benchmark entries for a category, joined with agent data, ordered by rank.
func (s *Store) GetBenchmarkByCategory(ctx context.Context, category string) ([]BenchmarkEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			bc.id, bc.category, bc.agent_id,
			COALESCE(a.name, '') AS agent_name,
			COALESCE(a.agent_id, '') AS agent_string_id,
			bc.rank, bc.score, bc.total_requests,
			bc.avg_response_ms, bc.error_rate, bc.revenue,
			bc.customer_count, bc.calculated_at
		FROM benchmark_cache bc
		JOIN agents a ON a.id = bc.agent_id
		WHERE bc.category = $1
		ORDER BY bc.rank ASC
	`, category)
	if err != nil {
		return nil, fmt.Errorf("get benchmark by category: %w", err)
	}
	defer rows.Close()

	var entries []BenchmarkEntry
	for rows.Next() {
		var e BenchmarkEntry
		if err := rows.Scan(
			&e.ID, &e.Category, &e.AgentID,
			&e.AgentName, &e.AgentStringID,
			&e.Rank, &e.Score, &e.TotalRequests,
			&e.AvgResponseMs, &e.ErrorRate, &e.Revenue,
			&e.CustomerCount, &e.CalculatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan benchmark entry: %w", err)
		}
		entries = append(entries, e)
	}

	if entries == nil {
		entries = []BenchmarkEntry{}
	}

	return entries, nil
}

// GetBenchmarkCategories returns all distinct categories in the benchmark cache.
func (s *Store) GetBenchmarkCategories(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT category FROM benchmark_cache ORDER BY category
	`)
	if err != nil {
		return nil, fmt.Errorf("get benchmark categories: %w", err)
	}
	defer rows.Close()

	var categories []string
	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err != nil {
			return nil, fmt.Errorf("scan benchmark category: %w", err)
		}
		categories = append(categories, cat)
	}

	if categories == nil {
		categories = []string{}
	}

	return categories, nil
}

// ClearBenchmarkCategory deletes all benchmark entries for a category.
func (s *Store) ClearBenchmarkCategory(ctx context.Context, category string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM benchmark_cache WHERE category = $1
	`, category)
	if err != nil {
		return fmt.Errorf("clear benchmark category: %w", err)
	}
	return nil
}
