package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type RequestLog struct {
	ID               int64      `json:"id"`
	AgentID          uuid.UUID  `json:"agent_id"`
	RequestID        string     `json:"request_id"`
	CustomerID       *string    `json:"customer_id,omitempty"`
	ToolName         *string    `json:"tool_name,omitempty"`
	Method           string     `json:"method"`
	Path             string     `json:"path"`
	StatusCode       int        `json:"status_code"`
	ResponseMs       float32    `json:"response_ms"`
	ErrorType        *string    `json:"error_type,omitempty"`
	X402Amount       *float64   `json:"x402_amount,omitempty"`
	X402TxHash       *string    `json:"x402_tx_hash,omitempty"`
	X402Token        *string    `json:"x402_token,omitempty"`
	X402Payer        *string    `json:"x402_payer,omitempty"`
	RequestBodySize  *int       `json:"request_body_size,omitempty"`
	ResponseBodySize *int       `json:"response_body_size,omitempty"`
	BatchID          string     `json:"batch_id"`
	SDKVersion       string     `json:"sdk_version"`
	CreatedAt        time.Time  `json:"created_at"`
}

type AgentStats struct {
	TotalRequests    int64   `json:"total_requests"`
	TodayRequests    int64   `json:"today_requests"`
	WeekRequests     int64   `json:"week_requests"`
	MonthRequests    int64   `json:"month_requests"`
	TotalRevenueUSDC float64 `json:"total_revenue_usdc"`
	AvgResponseMs    float64 `json:"avg_response_ms"`
	ErrorRate        float64 `json:"error_rate"`
}

// InsertRequestLogs batch-inserts request log entries for an agent.
func (s *Store) InsertRequestLogs(ctx context.Context, agentDBID uuid.UUID, entries []RequestLog) error {
	if len(entries) == 0 {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		_, err := tx.Exec(ctx, `
			INSERT INTO request_logs (
				agent_id, request_id, customer_id, tool_name, method, path,
				status_code, response_ms, error_type,
				x402_amount, x402_tx_hash, x402_token, x402_payer,
				request_body_size, response_body_size, batch_id, sdk_version
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		`,
			agentDBID, e.RequestID, e.CustomerID, e.ToolName, e.Method, e.Path,
			e.StatusCode, e.ResponseMs, e.ErrorType,
			e.X402Amount, e.X402TxHash, e.X402Token, e.X402Payer,
			e.RequestBodySize, e.ResponseBodySize, e.BatchID, e.SDKVersion,
		)
		if err != nil {
			return fmt.Errorf("insert request log: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	return nil
}

// GetAgentStats returns aggregate statistics for an agent.
func (s *Store) GetAgentStats(ctx context.Context, agentDBID uuid.UUID) (*AgentStats, error) {
	stats := &AgentStats{}

	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total_requests,
			COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_requests,
			COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS week_requests,
			COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS month_requests,
			COALESCE(SUM(x402_amount), 0) AS total_revenue_usdc,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE
				WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate
		FROM request_logs
		WHERE agent_id = $1
	`, agentDBID).Scan(
		&stats.TotalRequests,
		&stats.TodayRequests,
		&stats.WeekRequests,
		&stats.MonthRequests,
		&stats.TotalRevenueUSDC,
		&stats.AvgResponseMs,
		&stats.ErrorRate,
	)
	if err != nil {
		return nil, fmt.Errorf("get agent stats: %w", err)
	}

	return stats, nil
}

// DailyStats holds per-day aggregated metrics for charts.
type DailyStats struct {
	Date     string  `json:"date"`
	Requests int64   `json:"requests"`
	Revenue  float64 `json:"revenue"`
	Errors   int64   `json:"errors"`
}

// GetDailyStats returns daily request/revenue/error counts for the last N days.
func (s *Store) GetDailyStats(ctx context.Context, agentDBID uuid.UUID, days int) ([]DailyStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			DATE(created_at) AS date,
			COUNT(*) AS requests,
			COALESCE(SUM(x402_amount), 0) AS revenue,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		GROUP BY DATE(created_at)
		ORDER BY date
	`, agentDBID, days)
	if err != nil {
		return nil, fmt.Errorf("get daily stats: %w", err)
	}
	defer rows.Close()

	var stats []DailyStats
	for rows.Next() {
		var d DailyStats
		var date time.Time
		if err := rows.Scan(&date, &d.Requests, &d.Revenue, &d.Errors); err != nil {
			return nil, fmt.Errorf("scan daily stats: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		stats = append(stats, d)
	}

	if stats == nil {
		stats = []DailyStats{}
	}

	return stats, nil
}

// GetRecentRequests returns the most recent request logs for an agent.
func (s *Store) GetRecentRequests(ctx context.Context, agentDBID uuid.UUID, limit int) ([]RequestLog, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, request_id, customer_id, tool_name, method, path,
			status_code, response_ms, error_type,
			x402_amount, x402_tx_hash, x402_token, x402_payer,
			request_body_size, response_body_size, batch_id, sdk_version, created_at
		FROM request_logs
		WHERE agent_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, agentDBID, limit)
	if err != nil {
		return nil, fmt.Errorf("get recent requests: %w", err)
	}
	defer rows.Close()

	var logs []RequestLog
	for rows.Next() {
		var l RequestLog
		if err := rows.Scan(
			&l.ID, &l.AgentID, &l.RequestID, &l.CustomerID, &l.ToolName, &l.Method, &l.Path,
			&l.StatusCode, &l.ResponseMs, &l.ErrorType,
			&l.X402Amount, &l.X402TxHash, &l.X402Token, &l.X402Payer,
			&l.RequestBodySize, &l.ResponseBodySize, &l.BatchID, &l.SDKVersion, &l.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan request log: %w", err)
		}
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []RequestLog{}
	}

	return logs, nil
}
