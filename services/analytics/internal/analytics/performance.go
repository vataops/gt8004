package analytics

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// PerformanceReport contains aggregated performance metrics for an agent.
type PerformanceReport struct {
	P50ResponseMs   float64 `json:"p50_response_ms"`
	P95ResponseMs   float64 `json:"p95_response_ms"`
	P99ResponseMs   float64 `json:"p99_response_ms"`
	AvgResponseMs   float64 `json:"avg_response_ms"`
	ErrorRate       float64 `json:"error_rate"`
	TotalRequests   int64   `json:"total_requests"`
	SuccessRequests int64   `json:"success_requests"`
	ErrorRequests   int64   `json:"error_requests"`
	RequestsPerMin  float64 `json:"requests_per_min"`
	Uptime          float64 `json:"uptime"`
}

// PerformanceAnalytics provides performance intelligence operations.
type PerformanceAnalytics struct {
	store  *store.Store
	logger *zap.Logger
}

// NewPerformanceAnalytics creates a new PerformanceAnalytics instance.
func NewPerformanceAnalytics(s *store.Store, logger *zap.Logger) *PerformanceAnalytics {
	return &PerformanceAnalytics{
		store:  s,
		logger: logger,
	}
}

// GetPerformanceReport returns an aggregated performance report for the given agent and time window.
func (pa *PerformanceAnalytics) GetPerformanceReport(ctx context.Context, agentDBID uuid.UUID, windowHours int) (*PerformanceReport, error) {
	if windowHours <= 0 {
		windowHours = 24
	}

	var p50, p95, p99, avgMs float64
	var total, success, errors int64

	err := pa.store.Pool().QueryRow(ctx, `
		SELECT
			COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY response_ms), 0) AS p50,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95,
			COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY response_ms), 0) AS p99,
			COALESCE(AVG(response_ms), 0) AS avg_ms,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_code < 400) AS success,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
	`, agentDBID, fmt.Sprintf("%d", windowHours)).Scan(
		&p50, &p95, &p99, &avgMs, &total, &success, &errors,
	)
	if err != nil {
		return nil, fmt.Errorf("get performance report: %w", err)
	}

	var errorRate float64
	if total > 0 {
		errorRate = float64(errors) / float64(total)
	}

	windowMinutes := float64(windowHours) * 60
	var requestsPerMin float64
	if windowMinutes > 0 {
		requestsPerMin = float64(total) / windowMinutes
	}

	uptime := 1.0 - errorRate
	if uptime < 0 {
		uptime = 0
	}

	report := &PerformanceReport{
		P50ResponseMs:   p50,
		P95ResponseMs:   p95,
		P99ResponseMs:   p99,
		AvgResponseMs:   avgMs,
		ErrorRate:       errorRate,
		TotalRequests:   total,
		SuccessRequests: success,
		ErrorRequests:   errors,
		RequestsPerMin:  requestsPerMin,
		Uptime:          uptime * 100,
	}

	pa.logger.Debug("performance report generated",
		zap.String("agent_db_id", agentDBID.String()),
		zap.Int("window_hours", windowHours),
		zap.Int64("total_requests", total),
		zap.Float64("error_rate", errorRate),
	)

	return report, nil
}
