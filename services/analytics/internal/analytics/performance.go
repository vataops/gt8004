package analytics

import (
	"context"
	"fmt"
	"math"

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

	// NEW FIELDS
	P75ResponseMs   float64   `json:"p75_response_ms"`
	P90ResponseMs   float64   `json:"p90_response_ms"`
	HealthScore     float64   `json:"health_score"`
	HealthStatus    string    `json:"health_status"`

	// Trend data (24 hourly samples)
	P95Trend        []float64 `json:"p95_trend"`
	ErrorRateTrend  []float64 `json:"error_rate_trend"`
	ThroughputTrend []float64 `json:"throughput_trend"`
	UptimeTrend     []float64 `json:"uptime_trend"`

	// Deltas (vs 24h ago)
	HealthDelta     float64 `json:"health_delta"`
	P95DeltaMs      float64 `json:"p95_delta_ms"`
	ErrorDelta      float64 `json:"error_delta"`
	ThroughputDelta float64 `json:"throughput_delta"`
	UptimeDelta     float64 `json:"uptime_delta"`
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

// calculateHealthScore computes a 0-100 health score and status badge.
func calculateHealthScore(p95Ms, errorRate, uptime float64, totalRequests int64) (score float64, status string) {
	// Normalize P95 (0-1 scale, 1000ms = 1.0)
	normalizedP95 := math.Min(p95Ms/1000.0, 1.0)

	// Weighted components
	errorComponent := (1.0 - errorRate) * 40.0
	latencyComponent := (1.0 - normalizedP95) * 30.0
	uptimeComponent := (uptime / 100.0) * 20.0
	volumeComponent := 0.0
	if totalRequests > 0 {
		volumeComponent = 10.0
	}

	score = errorComponent + latencyComponent + uptimeComponent + volumeComponent

	// Determine status
	if score >= 90 {
		status = "Excellent"
	} else if score >= 70 {
		status = "Good"
	} else if score >= 50 {
		status = "Fair"
	} else {
		status = "Needs Attention"
	}

	return score, status
}

// GetPerformanceReport returns an aggregated performance report for the given agent and time window.
func (pa *PerformanceAnalytics) GetPerformanceReport(ctx context.Context, agentDBID uuid.UUID, windowHours int) (*PerformanceReport, error) {
	if windowHours <= 0 {
		windowHours = 24
	}

	// 1. Get current window metrics (including P75, P90)
	var p50, p75, p90, p95, p99, avgMs float64
	var total, success, errors int64

	err := pa.store.Pool().QueryRow(ctx, `
		SELECT
			COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY response_ms), 0) AS p50,
			COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY response_ms), 0) AS p75,
			COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY response_ms), 0) AS p90,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95,
			COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY response_ms), 0) AS p99,
			COALESCE(AVG(response_ms), 0) AS avg_ms,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_code < 400) AS success,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - ($2 || ' hours')::INTERVAL
	`, agentDBID, fmt.Sprintf("%d", windowHours)).Scan(
		&p50, &p75, &p90, &p95, &p99, &avgMs, &total, &success, &errors,
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

	// 2. Calculate health score
	healthScore, healthStatus := calculateHealthScore(p95, errorRate, uptime*100, total)

	// 3. Get 24h trend data (hourly buckets)
	trendRows, err := pa.store.Pool().Query(ctx, `
		SELECT
			EXTRACT(HOUR FROM created_at) AS hour,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95,
			COALESCE(AVG(CASE WHEN status_code >= 400 THEN 1.0 ELSE 0.0 END), 0) AS error_rate,
			COUNT(*) AS requests
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
		GROUP BY EXTRACT(HOUR FROM created_at)
		ORDER BY hour
	`, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get trend data: %w", err)
	}
	defer trendRows.Close()

	// Initialize trend arrays with 24 hours of data
	p95Trend := make([]float64, 0, 24)
	errorRateTrend := make([]float64, 0, 24)
	throughputTrend := make([]float64, 0, 24)
	uptimeTrend := make([]float64, 0, 24)

	for trendRows.Next() {
		var hour, p95Val, errorVal, requests float64
		if err := trendRows.Scan(&hour, &p95Val, &errorVal, &requests); err != nil {
			return nil, fmt.Errorf("scan trend row: %w", err)
		}
		p95Trend = append(p95Trend, p95Val)
		errorRateTrend = append(errorRateTrend, errorVal)
		throughputTrend = append(throughputTrend, requests/60.0) // requests per minute
		uptimeTrend = append(uptimeTrend, (1.0-errorVal)*100.0)
	}

	// 4. Get delta comparison (24-48h ago window)
	var prevP95, prevAvgMs float64
	var prevTotal, prevSuccess, prevErrors int64

	err = pa.store.Pool().QueryRow(ctx, `
		SELECT
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95,
			COALESCE(AVG(response_ms), 0) AS avg_ms,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_code < 400) AS success,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors
		FROM request_logs
		WHERE agent_id = $1
		  AND created_at >= NOW() - INTERVAL '48 hours'
		  AND created_at < NOW() - INTERVAL '24 hours'
	`, agentDBID).Scan(
		&prevP95, &prevAvgMs, &prevTotal, &prevSuccess, &prevErrors,
	)
	if err != nil {
		return nil, fmt.Errorf("get previous window metrics: %w", err)
	}

	var prevErrorRate float64
	if prevTotal > 0 {
		prevErrorRate = float64(prevErrors) / float64(prevTotal)
	}

	prevUptime := (1.0 - prevErrorRate) * 100
	if prevUptime < 0 {
		prevUptime = 0
	}

	prevWindowMinutes := float64(windowHours) * 60
	var prevRequestsPerMin float64
	if prevWindowMinutes > 0 && prevTotal > 0 {
		prevRequestsPerMin = float64(prevTotal) / prevWindowMinutes
	}

	prevHealthScore, _ := calculateHealthScore(prevP95, prevErrorRate, prevUptime, prevTotal)

	// Calculate deltas
	p95DeltaMs := p95 - prevP95
	errorDelta := errorRate - prevErrorRate
	throughputDelta := requestsPerMin - prevRequestsPerMin
	uptimeDelta := (uptime * 100) - prevUptime
	healthDelta := healthScore - prevHealthScore

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

		// New fields
		P75ResponseMs:   p75,
		P90ResponseMs:   p90,
		HealthScore:     healthScore,
		HealthStatus:    healthStatus,
		P95Trend:        p95Trend,
		ErrorRateTrend:  errorRateTrend,
		ThroughputTrend: throughputTrend,
		UptimeTrend:     uptimeTrend,
		HealthDelta:     healthDelta,
		P95DeltaMs:      p95DeltaMs,
		ErrorDelta:      errorDelta,
		ThroughputDelta: throughputDelta,
		UptimeDelta:     uptimeDelta,
	}

	pa.logger.Debug("performance report generated",
		zap.String("agent_db_id", agentDBID.String()),
		zap.Int("window_hours", windowHours),
		zap.Int64("total_requests", total),
		zap.Float64("error_rate", errorRate),
		zap.Float64("health_score", healthScore),
		zap.String("health_status", healthStatus),
	)

	return report, nil
}
