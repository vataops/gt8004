package store

import (
	"context"
	"fmt"
)

type Overview struct {
	TotalAgents      int     `json:"total_agents"`
	ActiveAgents     int     `json:"active_agents"`
	TotalRequests    int64   `json:"total_requests"`
	TotalRevenueUSDC float64 `json:"total_revenue_usdc"`
	TodayRequests    int64   `json:"today_requests"`
	AvgResponseMs    float64 `json:"avg_response_ms"`
}

// GetOverview returns aggregate dashboard statistics.
func (s *Store) GetOverview(ctx context.Context) (*Overview, error) {
	o := &Overview{}

	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total_agents,
			COUNT(*) FILTER (WHERE status = 'active') AS active_agents,
			COALESCE(SUM(total_requests), 0) AS total_requests,
			COALESCE(SUM(total_revenue_usdc), 0) AS total_revenue_usdc,
			COALESCE(AVG(avg_response_ms), 0) AS avg_response_ms
		FROM agents
	`).Scan(
		&o.TotalAgents,
		&o.ActiveAgents,
		&o.TotalRequests,
		&o.TotalRevenueUSDC,
		&o.AvgResponseMs,
	)
	if err != nil {
		return nil, fmt.Errorf("get overview: %w", err)
	}

	// Today's requests from the request_logs table
	err = s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM request_logs WHERE created_at >= CURRENT_DATE
	`).Scan(&o.TodayRequests)
	if err != nil {
		return nil, fmt.Errorf("get today requests: %w", err)
	}

	return o, nil
}
