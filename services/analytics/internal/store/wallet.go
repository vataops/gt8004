package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// WalletStats represents aggregated statistics across all agents owned by a wallet.
type WalletStats struct {
	TotalRequests  int64   `json:"total_requests"`
	TotalRevenue   float64 `json:"total_revenue"`
	TotalCustomers int     `json:"total_customers"`
	AvgResponseMs  float64 `json:"avg_response_ms"`
	ErrorRate      float64 `json:"error_rate"`
	TotalAgents    int     `json:"total_agents"`
	ActiveAgents   int     `json:"active_agents"`
}

// WalletDailyStats represents daily time-series data aggregated across owned agents.
type WalletDailyStats struct {
	Date          string  `json:"date"`
	Requests      int64   `json:"requests"`
	Revenue       float64 `json:"revenue"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
}

// WalletErrors represents error analysis across all owned agents.
type WalletErrors struct {
	TotalErrors  int64             `json:"total_errors"`
	ErrorRate    float64           `json:"error_rate"`
	ByStatusCode []StatusCodeCount `json:"by_status_code"`
	ByErrorType  []ErrorTypeCount  `json:"by_error_type"`
	ByAgent      []AgentErrorCount `json:"by_agent"`
}

type StatusCodeCount struct {
	StatusCode int   `json:"status_code"`
	Count      int64 `json:"count"`
}

type ErrorTypeCount struct {
	ErrorType string `json:"error_type"`
	Count     int64  `json:"count"`
}

type AgentErrorCount struct {
	AgentID    string  `json:"agent_id"`
	AgentName  string  `json:"agent_name"`
	ErrorCount int64   `json:"error_count"`
	ErrorRate  float64 `json:"error_rate"`
}

// GetWalletStats returns aggregated statistics across all agents owned by the wallet.
func (s *Store) GetWalletStats(ctx context.Context, agentDBIDs []uuid.UUID) (*WalletStats, error) {
	if len(agentDBIDs) == 0 {
		return &WalletStats{}, nil
	}

	query := `
		SELECT
			COALESCE(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END), 0) as total_requests,
			COALESCE(SUM(x402_amount), 0) as total_revenue,
			COUNT(DISTINCT customer_id) as total_customers,
			COALESCE(AVG(response_ms), 0) as avg_response_ms,
			COALESCE(
				SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::float /
				NULLIF(COUNT(*), 0),
				0
			) as error_rate
		FROM request_logs
		WHERE agent_id = ANY($1)
	`

	var stats WalletStats
	stats.TotalAgents = len(agentDBIDs)

	err := s.pool.QueryRow(ctx, query, agentDBIDs).Scan(
		&stats.TotalRequests,
		&stats.TotalRevenue,
		&stats.TotalCustomers,
		&stats.AvgResponseMs,
		&stats.ErrorRate,
	)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("get wallet stats: %w", err)
	}

	// Count active agents (agents with at least 1 request)
	activeQuery := `
		SELECT COUNT(DISTINCT agent_id)
		FROM request_logs
		WHERE agent_id = ANY($1)
	`
	err = s.pool.QueryRow(ctx, activeQuery, agentDBIDs).Scan(&stats.ActiveAgents)
	if err != nil && err != pgx.ErrNoRows {
		stats.ActiveAgents = 0
	}

	return &stats, nil
}

// GetWalletDailyStats returns daily time-series data aggregated across owned agents.
func (s *Store) GetWalletDailyStats(ctx context.Context, agentDBIDs []uuid.UUID, days int) ([]WalletDailyStats, error) {
	if len(agentDBIDs) == 0 {
		return []WalletDailyStats{}, nil
	}

	query := `
		SELECT
			DATE(created_at) as date,
			COUNT(CASE WHEN status_code < 400 THEN 1 END) as requests,
			COALESCE(SUM(x402_amount), 0) as revenue,
			COALESCE(AVG(response_ms), 0) as avg_response_ms,
			COALESCE(
				SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::float /
				NULLIF(COUNT(*), 0),
				0
			) as error_rate
		FROM request_logs
		WHERE agent_id = ANY($1)
		  AND created_at >= NOW() - INTERVAL '1 day' * $2
		GROUP BY DATE(created_at)
		ORDER BY date DESC
	`

	rows, err := s.pool.Query(ctx, query, agentDBIDs, days)
	if err != nil {
		return nil, fmt.Errorf("get wallet daily stats: %w", err)
	}
	defer rows.Close()

	var stats []WalletDailyStats
	for rows.Next() {
		var stat WalletDailyStats
		if err := rows.Scan(&stat.Date, &stat.Requests, &stat.Revenue, &stat.AvgResponseMs, &stat.ErrorRate); err != nil {
			return nil, fmt.Errorf("scan daily stats: %w", err)
		}
		stats = append(stats, stat)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate daily stats: %w", err)
	}

	return stats, nil
}

// GetWalletErrors returns error analysis across all owned agents.
func (s *Store) GetWalletErrors(ctx context.Context, agentDBIDs []uuid.UUID) (*WalletErrors, error) {
	if len(agentDBIDs) == 0 {
		return &WalletErrors{
			ByStatusCode: []StatusCodeCount{},
			ByErrorType:  []ErrorTypeCount{},
			ByAgent:      []AgentErrorCount{},
		}, nil
	}

	errors := &WalletErrors{
		ByStatusCode: []StatusCodeCount{},
		ByErrorType:  []ErrorTypeCount{},
		ByAgent:      []AgentErrorCount{},
	}

	// Total errors and error rate
	totalQuery := `
		SELECT
			COUNT(CASE WHEN status_code >= 400 THEN 1 END) as total_errors,
			COALESCE(
				COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / NULLIF(COUNT(*), 0),
				0
			) as error_rate
		FROM request_logs
		WHERE agent_id = ANY($1)
	`
	err := s.pool.QueryRow(ctx, totalQuery, agentDBIDs).Scan(&errors.TotalErrors, &errors.ErrorRate)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("get total errors: %w", err)
	}

	// Errors by status code
	statusQuery := `
		SELECT status_code, COUNT(*) as count
		FROM request_logs
		WHERE agent_id = ANY($1) AND status_code >= 400
		GROUP BY status_code
		ORDER BY count DESC
		LIMIT 10
	`
	rows, err := s.pool.Query(ctx, statusQuery, agentDBIDs)
	if err != nil {
		return nil, fmt.Errorf("get errors by status code: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sc StatusCodeCount
		if err := rows.Scan(&sc.StatusCode, &sc.Count); err != nil {
			return nil, fmt.Errorf("scan status code: %w", err)
		}
		errors.ByStatusCode = append(errors.ByStatusCode, sc)
	}
	rows.Close()

	// Errors by error type (if error_type column exists)
	typeQuery := `
		SELECT error_type, COUNT(*) as count
		FROM request_logs
		WHERE agent_id = ANY($1) AND error_type IS NOT NULL AND error_type != ''
		GROUP BY error_type
		ORDER BY count DESC
		LIMIT 10
	`
	rows, err = s.pool.Query(ctx, typeQuery, agentDBIDs)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var et ErrorTypeCount
			if err := rows.Scan(&et.ErrorType, &et.Count); err == nil {
				errors.ByErrorType = append(errors.ByErrorType, et)
			}
		}
		rows.Close()
	}

	// Errors by agent
	agentQuery := `
		SELECT
			rl.agent_id::text,
			COALESCE(a.name, rl.agent_id::text) as agent_name,
			COUNT(CASE WHEN rl.status_code >= 400 THEN 1 END) as error_count,
			COALESCE(
				COUNT(CASE WHEN rl.status_code >= 400 THEN 1 END)::float / NULLIF(COUNT(*), 0),
				0
			) as error_rate
		FROM request_logs rl
		LEFT JOIN agents a ON a.id = rl.agent_id
		WHERE rl.agent_id = ANY($1)
		GROUP BY rl.agent_id, a.name
		HAVING COUNT(CASE WHEN rl.status_code >= 400 THEN 1 END) > 0
		ORDER BY error_count DESC
	`
	rows, err = s.pool.Query(ctx, agentQuery, agentDBIDs)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var aec AgentErrorCount
			if err := rows.Scan(&aec.AgentID, &aec.AgentName, &aec.ErrorCount, &aec.ErrorRate); err == nil {
				errors.ByAgent = append(errors.ByAgent, aec)
			}
		}
		rows.Close()
	}

	return errors, nil
}
