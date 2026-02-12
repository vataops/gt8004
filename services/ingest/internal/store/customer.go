package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// UpsertCustomer inserts or updates a customer record with aggregated stats.
func (s *Store) UpsertCustomer(ctx context.Context, agentDBID uuid.UUID, customerID string, requestCount int64, revenue float64, avgMs float32, errorRate float32, country string, city string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO customers (agent_id, customer_id, total_requests, total_revenue, avg_response_ms, error_rate, country, city, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (agent_id, customer_id) DO UPDATE SET
			total_requests  = customers.total_requests + EXCLUDED.total_requests,
			total_revenue   = customers.total_revenue + EXCLUDED.total_revenue,
			avg_response_ms = EXCLUDED.avg_response_ms,
			error_rate      = EXCLUDED.error_rate,
			country         = CASE WHEN EXCLUDED.country != '' THEN EXCLUDED.country ELSE customers.country END,
			city            = CASE WHEN EXCLUDED.city != '' THEN EXCLUDED.city ELSE customers.city END,
			last_seen_at    = NOW(),
			updated_at      = NOW()
	`, agentDBID, customerID, requestCount, revenue, avgMs, errorRate, country, city)
	if err != nil {
		return fmt.Errorf("upsert customer: %w", err)
	}
	return nil
}

// GetDistinctCustomerCount returns the number of distinct customers for an agent.
func (s *Store) GetDistinctCustomerCount(ctx context.Context, agentDBID uuid.UUID) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM customers WHERE agent_id = $1
	`, agentDBID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("get distinct customer count: %w", err)
	}
	return count, nil
}
