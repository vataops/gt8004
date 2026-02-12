package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type RequestLog struct {
	ID               int64      `json:"id"`
	AgentID          uuid.UUID  `json:"agent_id"`
	RequestID        string     `json:"request_id"`
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
	RequestBody      *string          `json:"request_body,omitempty"`
	ResponseBody     *string          `json:"response_body,omitempty"`
	Headers          *json.RawMessage `json:"headers,omitempty"`
	BatchID          string           `json:"batch_id"`
	SDKVersion       string     `json:"sdk_version"`
	Protocol         *string    `json:"protocol,omitempty"`
	Source           *string    `json:"source,omitempty"`
	IPAddress        *string    `json:"ip_address,omitempty"`
	UserAgent        *string    `json:"user_agent,omitempty"`
	Referer          *string    `json:"referer,omitempty"`
	ContentType      *string    `json:"content_type,omitempty"`
	AcceptLanguage   *string    `json:"accept_language,omitempty"`
	Country          *string    `json:"country,omitempty"`
	City             *string    `json:"city,omitempty"`
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
				agent_id, request_id, tool_name, method, path,
				status_code, response_ms, error_type,
				x402_amount, x402_tx_hash, x402_token, x402_payer,
				request_body_size, response_body_size,
				request_body, response_body, headers,
				batch_id, sdk_version, protocol, source,
				ip_address, user_agent, referer, content_type, accept_language,
				country, city
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
		`,
			agentDBID, e.RequestID, e.ToolName, e.Method, e.Path,
			e.StatusCode, e.ResponseMs, e.ErrorType,
			e.X402Amount, e.X402TxHash, e.X402Token, e.X402Payer,
			e.RequestBodySize, e.ResponseBodySize,
			e.RequestBody, e.ResponseBody, e.Headers,
			e.BatchID, e.SDKVersion, e.Protocol, e.Source,
			e.IPAddress, e.UserAgent, e.Referer, e.ContentType, e.AcceptLanguage,
			e.Country, e.City,
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
	Date            string  `json:"date"`
	Requests        int64   `json:"requests"`
	Revenue         float64 `json:"revenue"`
	Errors          int64   `json:"errors"`
	UniqueCustomers int64   `json:"unique_customers"`
	AvgResponseMs   float64 `json:"avg_response_ms"`
	P95ResponseMs   float64 `json:"p95_response_ms"`
}

// GetDailyStats returns daily request/revenue/error counts and response time metrics for the last N days.
func (s *Store) GetDailyStats(ctx context.Context, agentDBID uuid.UUID, days int) ([]DailyStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			DATE(created_at) AS date,
			COUNT(*) AS requests,
			COALESCE(SUM(x402_amount), 0) AS revenue,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
			COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) AS unique_customers,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95_response_ms
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
		if err := rows.Scan(&date, &d.Requests, &d.Revenue, &d.Errors, &d.UniqueCustomers, &d.AvgResponseMs, &d.P95ResponseMs); err != nil {
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
		SELECT id, agent_id, request_id, tool_name, method, path,
			status_code, response_ms, error_type,
			x402_amount, x402_tx_hash, x402_token, x402_payer,
			request_body_size, response_body_size,
			request_body, response_body, headers,
			batch_id, sdk_version, protocol, source,
			ip_address, user_agent, referer, content_type, accept_language,
			country, city, created_at
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
			&l.ID, &l.AgentID, &l.RequestID, &l.ToolName, &l.Method, &l.Path,
			&l.StatusCode, &l.ResponseMs, &l.ErrorType,
			&l.X402Amount, &l.X402TxHash, &l.X402Token, &l.X402Payer,
			&l.RequestBodySize, &l.ResponseBodySize,
			&l.RequestBody, &l.ResponseBody, &l.Headers,
			&l.BatchID, &l.SDKVersion, &l.Protocol, &l.Source,
			&l.IPAddress, &l.UserAgent, &l.Referer, &l.ContentType, &l.AcceptLanguage,
			&l.Country, &l.City, &l.CreatedAt,
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

// ---------- Protocol Analytics ----------

// ProtocolStats holds aggregated metrics per protocol.
type ProtocolStats struct {
	Source        string  `json:"source"`
	Protocol      string  `json:"protocol"`
	RequestCount  int64   `json:"request_count"`
	Percentage    float64 `json:"percentage"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
	P95ResponseMs float64 `json:"p95_response_ms"`
}

// GetProtocolBreakdown returns per-protocol analytics for an agent within a time window.
func (s *Store) GetProtocolBreakdown(ctx context.Context, agentDBID uuid.UUID, days int) ([]ProtocolStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		WITH totals AS (
			SELECT COUNT(*) AS total
			FROM request_logs
			WHERE agent_id = $1 AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		)
		SELECT
			COALESCE(source, 'sdk') AS source,
			COALESCE(protocol, 'http') AS protocol,
			COUNT(*) AS request_count,
			CASE WHEN t.total > 0
				THEN CAST(COUNT(*) AS FLOAT) / t.total * 100
				ELSE 0
			END AS percentage,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95_response_ms
		FROM request_logs, totals t
		WHERE agent_id = $1 AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		GROUP BY source, protocol, t.total
		ORDER BY request_count DESC
	`, agentDBID, days)
	if err != nil {
		return nil, fmt.Errorf("get protocol breakdown: %w", err)
	}
	defer rows.Close()

	var stats []ProtocolStats
	for rows.Next() {
		var s ProtocolStats
		if err := rows.Scan(&s.Source, &s.Protocol, &s.RequestCount, &s.Percentage,
			&s.AvgResponseMs, &s.ErrorRate, &s.P95ResponseMs); err != nil {
			return nil, fmt.Errorf("scan protocol stats: %w", err)
		}
		stats = append(stats, s)
	}
	if stats == nil {
		stats = []ProtocolStats{}
	}
	return stats, nil
}

// ToolUsage holds tool-level usage metrics.
type ToolUsage struct {
	ToolName      string  `json:"tool_name"`
	CallCount     int64   `json:"call_count"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	P95ResponseMs float64 `json:"p95_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
	Revenue       float64 `json:"revenue"`
}

// GetToolUsageRanking returns tools ranked by P95 latency (slowest first) for an agent.
func (s *Store) GetToolUsageRanking(ctx context.Context, agentDBID uuid.UUID, days int, limit int) ([]ToolUsage, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			COALESCE(tool_name, 'unknown') AS tool_name,
			COUNT(*) AS call_count,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_ms), 0) AS p95_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(SUM(x402_amount), 0) AS revenue
		FROM request_logs
		WHERE agent_id = $1
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		  AND tool_name IS NOT NULL
		GROUP BY tool_name
		ORDER BY p95_response_ms DESC
		LIMIT $3
	`, agentDBID, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get tool usage ranking: %w", err)
	}
	defer rows.Close()

	var tools []ToolUsage
	for rows.Next() {
		var t ToolUsage
		if err := rows.Scan(&t.ToolName, &t.CallCount, &t.AvgResponseMs, &t.P95ResponseMs, &t.ErrorRate, &t.Revenue); err != nil {
			return nil, fmt.Errorf("scan tool usage: %w", err)
		}
		tools = append(tools, t)
	}
	if tools == nil {
		tools = []ToolUsage{}
	}
	return tools, nil
}

// HealthMetrics holds real-time health indicators.
type HealthMetrics struct {
	ErrorRate     float64 `json:"error_rate"`
	PaymentRate   float64 `json:"payment_rate"`
	TimeoutRate   float64 `json:"timeout_rate"`
	SuccessRate   float64 `json:"success_rate"`
	TotalRequests int64   `json:"total_requests"`
	ErrorCount    int64   `json:"error_count"`
	PaymentCount  int64   `json:"payment_count"`
	TimeoutCount  int64   `json:"timeout_count"`
	WindowMinutes int     `json:"window_minutes"`
}

// GetHealthMetrics returns real-time health indicators for the last N minutes.
func (s *Store) GetHealthMetrics(ctx context.Context, agentDBID uuid.UUID, windowMinutes int) (*HealthMetrics, error) {
	if windowMinutes <= 0 {
		windowMinutes = 60
	}

	h := &HealthMetrics{WindowMinutes: windowMinutes}
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
			COUNT(*) FILTER (WHERE status_code = 402) AS payments,
			COUNT(*) FILTER (WHERE status_code IN (408, 504) OR response_ms > 30000) AS timeouts
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - make_interval(mins => $2)
	`, agentDBID, windowMinutes).Scan(
		&h.TotalRequests, &h.ErrorCount, &h.PaymentCount, &h.TimeoutCount,
	)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("get health metrics: %w", err)
	}

	if h.TotalRequests > 0 {
		h.ErrorRate = float64(h.ErrorCount) / float64(h.TotalRequests)
		h.PaymentRate = float64(h.PaymentCount) / float64(h.TotalRequests)
		h.TimeoutRate = float64(h.TimeoutCount) / float64(h.TotalRequests)
		h.SuccessRate = 1.0 - h.ErrorRate
	} else {
		h.SuccessRate = 1.0
	}
	return h, nil
}

// CustomerIntelligence holds customer segmentation data.
type CustomerIntelligence struct {
	TotalCustomers    int64       `json:"total_customers"`
	NewThisWeek       int64       `json:"new_this_week"`
	ReturningThisWeek int64       `json:"returning_this_week"`
	TopCallers        []TopCaller `json:"top_callers"`
}

// TopCaller represents a top customer by request count.
type TopCaller struct {
	CustomerID   string  `json:"customer_id"`
	RequestCount int64   `json:"request_count"`
	Revenue      float64 `json:"revenue"`
	LastSeenAt   string  `json:"last_seen_at"`
}

// GetCustomerIntelligence returns customer segmentation for an agent.
func (s *Store) GetCustomerIntelligence(ctx context.Context, agentDBID uuid.UUID, topN int) (*CustomerIntelligence, error) {
	if topN <= 0 {
		topN = 5
	}

	ci := &CustomerIntelligence{}

	// Count totals and new/returning this week
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE first_seen_at >= CURRENT_DATE - INTERVAL '7 days') AS new_this_week,
			COUNT(*) FILTER (WHERE first_seen_at < CURRENT_DATE - INTERVAL '7 days'
				AND last_seen_at >= CURRENT_DATE - INTERVAL '7 days') AS returning_this_week
		FROM customers
		WHERE agent_id = $1
	`, agentDBID).Scan(&ci.TotalCustomers, &ci.NewThisWeek, &ci.ReturningThisWeek)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("get customer intelligence counts: %w", err)
	}

	// Top callers
	rows, err := s.pool.Query(ctx, `
		SELECT customer_id, total_requests, total_revenue, last_seen_at
		FROM customers
		WHERE agent_id = $1
		ORDER BY total_requests DESC
		LIMIT $2
	`, agentDBID, topN)
	if err != nil {
		return nil, fmt.Errorf("get top callers: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tc TopCaller
		var lastSeen time.Time
		if err := rows.Scan(&tc.CustomerID, &tc.RequestCount, &tc.Revenue, &lastSeen); err != nil {
			return nil, fmt.Errorf("scan top caller: %w", err)
		}
		tc.LastSeenAt = lastSeen.Format(time.RFC3339)
		ci.TopCallers = append(ci.TopCallers, tc)
	}
	if ci.TopCallers == nil {
		ci.TopCallers = []TopCaller{}
	}
	return ci, nil
}

// DailyProtocolStats holds per-day per-protocol breakdown.
type DailyProtocolStats struct {
	Date     string  `json:"date"`
	Source   string  `json:"source"`
	Protocol string  `json:"protocol"`
	Requests int64   `json:"requests"`
	Errors   int64   `json:"errors"`
	Revenue  float64 `json:"revenue"`
}

// GetDailyProtocolStats returns daily stats broken down by protocol.
func (s *Store) GetDailyProtocolStats(ctx context.Context, agentDBID uuid.UUID, days int) ([]DailyProtocolStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			DATE(created_at) AS date,
			COALESCE(source, 'sdk') AS source,
			COALESCE(protocol, 'http') AS protocol,
			COUNT(*) AS requests,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
			COALESCE(SUM(x402_amount), 0) AS revenue
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		GROUP BY DATE(created_at), source, protocol
		ORDER BY date, source, protocol
	`, agentDBID, days)
	if err != nil {
		return nil, fmt.Errorf("get daily protocol stats: %w", err)
	}
	defer rows.Close()

	var stats []DailyProtocolStats
	for rows.Next() {
		var d DailyProtocolStats
		var date time.Time
		if err := rows.Scan(&date, &d.Source, &d.Protocol, &d.Requests, &d.Errors, &d.Revenue); err != nil {
			return nil, fmt.Errorf("scan daily protocol stats: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		stats = append(stats, d)
	}
	if stats == nil {
		stats = []DailyProtocolStats{}
	}
	return stats, nil
}

// ---------- MCP / A2A Deep-Dive ----------

// GetMCPToolBreakdown returns MCP-specific tool usage ranked by call count.
func (s *Store) GetMCPToolBreakdown(ctx context.Context, agentDBID uuid.UUID, days int, limit int) ([]ToolUsage, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 15
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			COALESCE(tool_name, 'unknown') AS tool_name,
			COUNT(*) AS call_count,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(SUM(x402_amount), 0) AS revenue
		FROM request_logs
		WHERE agent_id = $1
		  AND protocol = 'mcp'
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		  AND tool_name IS NOT NULL
		GROUP BY tool_name
		ORDER BY call_count DESC
		LIMIT $3
	`, agentDBID, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get mcp tool breakdown: %w", err)
	}
	defer rows.Close()

	var tools []ToolUsage
	for rows.Next() {
		var t ToolUsage
		if err := rows.Scan(&t.ToolName, &t.CallCount, &t.AvgResponseMs, &t.ErrorRate, &t.Revenue); err != nil {
			return nil, fmt.Errorf("scan mcp tool: %w", err)
		}
		tools = append(tools, t)
	}
	if tools == nil {
		tools = []ToolUsage{}
	}
	return tools, nil
}

// A2APartner represents an agent that communicates via the A2A protocol.
type A2APartner struct {
	CustomerID    string  `json:"customer_id"`
	CallCount     int64   `json:"call_count"`
	Revenue       float64 `json:"revenue"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
	LastSeenAt    string  `json:"last_seen_at"`
}

// GetA2APartnerBreakdown returns top A2A callers (partner agents).
func (s *Store) GetA2APartnerBreakdown(ctx context.Context, agentDBID uuid.UUID, days int, limit int) ([]A2APartner, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			ip_address,
			COUNT(*) AS call_count,
			COALESCE(SUM(x402_amount), 0) AS revenue,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			MAX(created_at) AS last_seen_at
		FROM request_logs
		WHERE agent_id = $1
		  AND protocol = 'a2a'
		  AND ip_address IS NOT NULL
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		GROUP BY ip_address
		ORDER BY call_count DESC
		LIMIT $3
	`, agentDBID, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get a2a partner breakdown: %w", err)
	}
	defer rows.Close()

	var partners []A2APartner
	for rows.Next() {
		var p A2APartner
		var lastSeen time.Time
		if err := rows.Scan(&p.CustomerID, &p.CallCount, &p.Revenue,
			&p.AvgResponseMs, &p.ErrorRate, &lastSeen); err != nil {
			return nil, fmt.Errorf("scan a2a partner: %w", err)
		}
		p.LastSeenAt = lastSeen.Format(time.RFC3339)
		partners = append(partners, p)
	}
	if partners == nil {
		partners = []A2APartner{}
	}
	return partners, nil
}

// EndpointStats holds A2A endpoint-level metrics.
type EndpointStats struct {
	Endpoint      string  `json:"endpoint"`
	Method        string  `json:"method"`
	CallCount     int64   `json:"call_count"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
	Revenue       float64 `json:"revenue"`
}

// GetA2AEndpointStats returns A2A endpoint usage ranked by call count.
func (s *Store) GetA2AEndpointStats(ctx context.Context, agentDBID uuid.UUID, days int, limit int) ([]EndpointStats, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			path,
			method,
			COUNT(*) AS call_count,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(SUM(x402_amount), 0) AS revenue
		FROM request_logs
		WHERE agent_id = $1
		  AND protocol = 'a2a'
		  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
		GROUP BY path, method
		ORDER BY call_count DESC
		LIMIT $3
	`, agentDBID, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get a2a endpoint stats: %w", err)
	}
	defer rows.Close()

	var endpoints []EndpointStats
	for rows.Next() {
		var e EndpointStats
		if err := rows.Scan(&e.Endpoint, &e.Method, &e.CallCount,
			&e.AvgResponseMs, &e.ErrorRate, &e.Revenue); err != nil {
			return nil, fmt.Errorf("scan a2a endpoint: %w", err)
		}
		endpoints = append(endpoints, e)
	}
	if endpoints == nil {
		endpoints = []EndpointStats{}
	}
	return endpoints, nil
}

// ---------- Customer Detail Queries ----------

// CustomerToolUsage holds per-tool usage for a specific customer.
type CustomerToolUsage struct {
	ToolName      string  `json:"tool_name"`
	CallCount     int64   `json:"call_count"`
	AvgResponseMs float64 `json:"avg_response_ms"`
	ErrorRate     float64 `json:"error_rate"`
	Revenue       float64 `json:"revenue"`
}

// GetCustomerLogs returns recent request logs for a specific customer.
func (s *Store) GetCustomerLogs(ctx context.Context, agentDBID uuid.UUID, customerID string, limit int) ([]RequestLog, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, request_id, tool_name, method, path,
			status_code, response_ms, error_type,
			x402_amount, x402_tx_hash, x402_token, x402_payer,
			request_body_size, response_body_size,
			request_body, response_body,
			batch_id, sdk_version, protocol, source,
			ip_address, user_agent, referer, content_type, accept_language,
			country, city, created_at
		FROM request_logs
		WHERE agent_id = $1 AND ip_address = $2
		ORDER BY created_at DESC
		LIMIT $3
	`, agentDBID, customerID, limit)
	if err != nil {
		return nil, fmt.Errorf("get customer logs: %w", err)
	}
	defer rows.Close()

	var logs []RequestLog
	for rows.Next() {
		var l RequestLog
		if err := rows.Scan(
			&l.ID, &l.AgentID, &l.RequestID, &l.ToolName, &l.Method, &l.Path,
			&l.StatusCode, &l.ResponseMs, &l.ErrorType,
			&l.X402Amount, &l.X402TxHash, &l.X402Token, &l.X402Payer,
			&l.RequestBodySize, &l.ResponseBodySize,
			&l.RequestBody, &l.ResponseBody,
			&l.BatchID, &l.SDKVersion, &l.Protocol, &l.Source,
			&l.IPAddress, &l.UserAgent, &l.Referer, &l.ContentType, &l.AcceptLanguage,
			&l.Country, &l.City, &l.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan customer log: %w", err)
		}
		logs = append(logs, l)
	}

	if logs == nil {
		logs = []RequestLog{}
	}

	return logs, nil
}

// GetCustomerToolUsage returns per-tool usage stats for a specific customer.
func (s *Store) GetCustomerToolUsage(ctx context.Context, agentDBID uuid.UUID, customerID string) ([]CustomerToolUsage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			COALESCE(tool_name, path) AS tool_name,
			COUNT(*) AS call_count,
			COALESCE(AVG(response_ms), 0) AS avg_response_ms,
			CASE WHEN COUNT(*) > 0
				THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
				ELSE 0
			END AS error_rate,
			COALESCE(SUM(x402_amount), 0) AS revenue
		FROM request_logs
		WHERE agent_id = $1 AND ip_address = $2
		GROUP BY COALESCE(tool_name, path)
		ORDER BY call_count DESC
		LIMIT 20
	`, agentDBID, customerID)
	if err != nil {
		return nil, fmt.Errorf("get customer tool usage: %w", err)
	}
	defer rows.Close()

	var tools []CustomerToolUsage
	for rows.Next() {
		var t CustomerToolUsage
		if err := rows.Scan(&t.ToolName, &t.CallCount, &t.AvgResponseMs, &t.ErrorRate, &t.Revenue); err != nil {
			return nil, fmt.Errorf("scan customer tool usage: %w", err)
		}
		tools = append(tools, t)
	}
	if tools == nil {
		tools = []CustomerToolUsage{}
	}
	return tools, nil
}

// GetCustomerDailyStats returns daily stats for a specific customer.
func (s *Store) GetCustomerDailyStats(ctx context.Context, agentDBID uuid.UUID, customerID string, days int) ([]DailyStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			DATE(created_at) AS date,
			COUNT(*) AS requests,
			COALESCE(SUM(x402_amount), 0) AS revenue,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
			0 AS unique_customers
		FROM request_logs
		WHERE agent_id = $1 AND ip_address = $2
		  AND created_at >= CURRENT_DATE - $3 * INTERVAL '1 day'
		GROUP BY DATE(created_at)
		ORDER BY date
	`, agentDBID, customerID, days)
	if err != nil {
		return nil, fmt.Errorf("get customer daily stats: %w", err)
	}
	defer rows.Close()

	var stats []DailyStats
	for rows.Next() {
		var d DailyStats
		var date time.Time
		if err := rows.Scan(&date, &d.Requests, &d.Revenue, &d.Errors, &d.UniqueCustomers); err != nil {
			return nil, fmt.Errorf("scan customer daily stats: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		stats = append(stats, d)
	}

	if stats == nil {
		stats = []DailyStats{}
	}

	return stats, nil
}

// ---------- Conversion Funnel ----------

// FunnelSummary holds the overall conversion funnel counts.
type FunnelSummary struct {
	MCPCustomers   int64   `json:"mcp_customers"`
	MCPToA2A       int64   `json:"mcp_to_a2a"`
	MCPToA2APaid   int64   `json:"mcp_to_a2a_paid"`
	A2ACustomers   int64   `json:"a2a_customers"`
	A2AToPaid      int64   `json:"a2a_to_paid"`
	PaidCustomers  int64   `json:"paid_customers"`
	TotalCustomers int64   `json:"total_customers"`
	MCPToA2ARate   float64 `json:"mcp_to_a2a_rate"`
	A2AToPaidRate  float64 `json:"a2a_to_paid_rate"`
	FullFunnelRate float64 `json:"full_funnel_rate"`
}

// DailyFunnelStats holds per-day funnel progression counts.
type DailyFunnelStats struct {
	Date          string `json:"date"`
	MCPCustomers  int64  `json:"mcp_customers"`
	A2ACustomers  int64  `json:"a2a_customers"`
	PaidCustomers int64  `json:"paid_customers"`
}

// CustomerJourney holds an individual customer's conversion journey.
type CustomerJourney struct {
	CustomerID    string   `json:"customer_id"`
	TotalRequests int64    `json:"total_requests"`
	TotalRevenue  float64  `json:"total_revenue"`
	HasMCP        bool     `json:"has_mcp"`
	HasA2A        bool     `json:"has_a2a"`
	HasA2APaid    bool     `json:"has_a2a_paid"`
	FirstMCPAt    *string  `json:"first_mcp_at,omitempty"`
	FirstA2AAt    *string  `json:"first_a2a_at,omitempty"`
	FirstPaidAt   *string  `json:"first_paid_at,omitempty"`
	LastSeenAt    string   `json:"last_seen_at"`
	DaysToConvert *float64 `json:"days_to_convert,omitempty"`
}

// FunnelReport aggregates all funnel data into a single response.
type FunnelReport struct {
	Summary    *FunnelSummary     `json:"summary"`
	DailyTrend []DailyFunnelStats `json:"daily_trend"`
	Journeys   []CustomerJourney  `json:"journeys"`
}

// GetFunnelSummary returns the overall conversion funnel counts.
func (s *Store) GetFunnelSummary(ctx context.Context, agentDBID uuid.UUID, days int) (*FunnelSummary, error) {
	if days <= 0 {
		days = 30
	}

	f := &FunnelSummary{}
	err := s.pool.QueryRow(ctx, `
		WITH customer_protocols AS (
			SELECT
				ip_address,
				BOOL_OR(protocol = 'mcp') AS has_mcp,
				BOOL_OR(protocol = 'a2a') AS has_a2a,
				BOOL_OR(protocol = 'a2a' AND x402_amount IS NOT NULL AND x402_amount > 0) AS has_a2a_paid
			FROM request_logs
			WHERE agent_id = $1
			  AND ip_address IS NOT NULL
			  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
			GROUP BY ip_address
		)
		SELECT
			COUNT(*) FILTER (WHERE has_mcp),
			COUNT(*) FILTER (WHERE has_mcp AND has_a2a),
			COUNT(*) FILTER (WHERE has_mcp AND has_a2a AND has_a2a_paid),
			COUNT(*) FILTER (WHERE has_a2a),
			COUNT(*) FILTER (WHERE has_a2a AND has_a2a_paid),
			COUNT(*) FILTER (WHERE has_a2a_paid),
			COUNT(*)
		FROM customer_protocols
	`, agentDBID, days).Scan(
		&f.MCPCustomers, &f.MCPToA2A, &f.MCPToA2APaid,
		&f.A2ACustomers, &f.A2AToPaid, &f.PaidCustomers,
		&f.TotalCustomers,
	)
	if err != nil {
		return nil, fmt.Errorf("get funnel summary: %w", err)
	}

	if f.MCPCustomers > 0 {
		f.MCPToA2ARate = float64(f.MCPToA2A) / float64(f.MCPCustomers)
	}
	if f.A2ACustomers > 0 {
		f.A2AToPaidRate = float64(f.A2AToPaid) / float64(f.A2ACustomers)
	}
	if f.MCPCustomers > 0 {
		f.FullFunnelRate = float64(f.MCPToA2APaid) / float64(f.MCPCustomers)
	}

	return f, nil
}

// GetDailyFunnelStats returns per-day funnel progression counts.
func (s *Store) GetDailyFunnelStats(ctx context.Context, agentDBID uuid.UUID, days int) ([]DailyFunnelStats, error) {
	if days <= 0 {
		days = 30
	}

	rows, err := s.pool.Query(ctx, `
		WITH daily_cumulative AS (
			SELECT
				DATE(created_at) AS date,
				ip_address,
				BOOL_OR(protocol = 'mcp') AS has_mcp,
				BOOL_OR(protocol = 'a2a') AS has_a2a,
				BOOL_OR(protocol = 'a2a' AND x402_amount IS NOT NULL AND x402_amount > 0) AS has_a2a_paid
			FROM request_logs
			WHERE agent_id = $1
			  AND ip_address IS NOT NULL
			  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
			GROUP BY DATE(created_at), ip_address
		)
		SELECT
			date,
			COUNT(DISTINCT ip_address) FILTER (WHERE has_mcp),
			COUNT(DISTINCT ip_address) FILTER (WHERE has_a2a),
			COUNT(DISTINCT ip_address) FILTER (WHERE has_a2a_paid)
		FROM daily_cumulative
		GROUP BY date
		ORDER BY date
	`, agentDBID, days)
	if err != nil {
		return nil, fmt.Errorf("get daily funnel stats: %w", err)
	}
	defer rows.Close()

	var stats []DailyFunnelStats
	for rows.Next() {
		var d DailyFunnelStats
		var date time.Time
		if err := rows.Scan(&date, &d.MCPCustomers, &d.A2ACustomers, &d.PaidCustomers); err != nil {
			return nil, fmt.Errorf("scan daily funnel stats: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		stats = append(stats, d)
	}
	if stats == nil {
		stats = []DailyFunnelStats{}
	}
	return stats, nil
}

// GetCustomerJourneys returns individual customer conversion journeys.
func (s *Store) GetCustomerJourneys(ctx context.Context, agentDBID uuid.UUID, days int, limit int) ([]CustomerJourney, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.pool.Query(ctx, `
		WITH customer_journey AS (
			SELECT
				ip_address,
				COUNT(*) AS total_requests,
				COALESCE(SUM(x402_amount), 0) AS total_revenue,
				BOOL_OR(protocol = 'mcp') AS has_mcp,
				BOOL_OR(protocol = 'a2a') AS has_a2a,
				BOOL_OR(protocol = 'a2a' AND x402_amount IS NOT NULL AND x402_amount > 0) AS has_a2a_paid,
				MIN(created_at) FILTER (WHERE protocol = 'mcp') AS first_mcp_at,
				MIN(created_at) FILTER (WHERE protocol = 'a2a') AS first_a2a_at,
				MIN(created_at) FILTER (WHERE protocol = 'a2a' AND x402_amount IS NOT NULL AND x402_amount > 0) AS first_paid_at,
				MAX(created_at) AS last_seen_at
			FROM request_logs
			WHERE agent_id = $1
			  AND ip_address IS NOT NULL
			  AND created_at >= CURRENT_DATE - $2 * INTERVAL '1 day'
			GROUP BY ip_address
		)
		SELECT
			ip_address, total_requests, total_revenue,
			has_mcp, has_a2a, has_a2a_paid,
			first_mcp_at, first_a2a_at, first_paid_at,
			last_seen_at,
			CASE
				WHEN first_mcp_at IS NOT NULL AND first_paid_at IS NOT NULL
				THEN EXTRACT(EPOCH FROM (first_paid_at - first_mcp_at)) / 86400.0
				ELSE NULL
			END AS days_to_convert
		FROM customer_journey
		WHERE has_mcp AND has_a2a
		ORDER BY has_a2a_paid DESC, total_revenue DESC
		LIMIT $3
	`, agentDBID, days, limit)
	if err != nil {
		return nil, fmt.Errorf("get customer journeys: %w", err)
	}
	defer rows.Close()

	var journeys []CustomerJourney
	for rows.Next() {
		var j CustomerJourney
		var firstMCP, firstA2A, firstPaid *time.Time
		var lastSeen time.Time
		if err := rows.Scan(
			&j.CustomerID, &j.TotalRequests, &j.TotalRevenue,
			&j.HasMCP, &j.HasA2A, &j.HasA2APaid,
			&firstMCP, &firstA2A, &firstPaid,
			&lastSeen, &j.DaysToConvert,
		); err != nil {
			return nil, fmt.Errorf("scan customer journey: %w", err)
		}
		if firstMCP != nil {
			s := firstMCP.Format(time.RFC3339)
			j.FirstMCPAt = &s
		}
		if firstA2A != nil {
			s := firstA2A.Format(time.RFC3339)
			j.FirstA2AAt = &s
		}
		if firstPaid != nil {
			s := firstPaid.Format(time.RFC3339)
			j.FirstPaidAt = &s
		}
		j.LastSeenAt = lastSeen.Format(time.RFC3339)
		journeys = append(journeys, j)
	}
	if journeys == nil {
		journeys = []CustomerJourney{}
	}
	return journeys, nil
}

// GetAgentErrorRate returns the 30-day error rate for a specific agent.
func (s *Store) GetAgentErrorRate(ctx context.Context, agentDBID uuid.UUID) (float64, error) {
	var total, errors int64
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status_code >= 400) AS errors
		FROM request_logs
		WHERE agent_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
	`, agentDBID).Scan(&total, &errors)
	if err != nil {
		return 0, fmt.Errorf("get agent error rate: %w", err)
	}

	if total == 0 {
		return 0, nil
	}

	return float64(errors) / float64(total), nil
}
