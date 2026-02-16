package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RevenueEntry represents a single revenue event.
type RevenueEntry struct {
	ID           int64     `json:"id"`
	AgentID      uuid.UUID `json:"agent_id"`
	CustomerID   *string   `json:"customer_id,omitempty"`
	ToolName     *string   `json:"tool_name,omitempty"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"`
	TxHash       *string   `json:"tx_hash,omitempty"`
	PayerAddress *string   `json:"payer_address,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// RevenuePeriod represents aggregated revenue for a time period.
type RevenuePeriod struct {
	Period string  `json:"period"`
	Amount float64 `json:"amount"`
	Count  int64   `json:"count"`
}

// RevenueByTool represents aggregated revenue grouped by tool name.
type RevenueByTool struct {
	ToolName string  `json:"tool_name"`
	Amount   float64 `json:"amount"`
	Count    int64   `json:"count"`
}

// InsertRevenueEntry inserts a single revenue entry.
func (s *Store) InsertRevenueEntry(ctx context.Context, entry RevenueEntry) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO revenue_entries (agent_id, customer_id, tool_name, amount, currency, tx_hash, payer_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, entry.AgentID, entry.CustomerID, entry.ToolName, entry.Amount, entry.Currency, entry.TxHash, entry.PayerAddress)
	if err != nil {
		return fmt.Errorf("insert revenue entry: %w", err)
	}
	return nil
}

// GetRevenueByPeriod returns revenue aggregated by month or week.
func (s *Store) GetRevenueByPeriod(ctx context.Context, agentDBID uuid.UUID, period string) ([]RevenuePeriod, error) {
	truncUnit := "month"
	dateFormat := "YYYY-MM"
	if period == "weekly" {
		truncUnit = "week"
		dateFormat = "IYYY-IW"
	}

	query := fmt.Sprintf(`
		SELECT to_char(date_trunc('%s', created_at), '%s') AS period,
			COALESCE(SUM(amount), 0) AS amount,
			COUNT(*) AS count
		FROM revenue_entries
		WHERE agent_id = $1
		GROUP BY date_trunc('%s', created_at)
		ORDER BY date_trunc('%s', created_at) DESC
	`, truncUnit, dateFormat, truncUnit, truncUnit)

	rows, err := s.pool.Query(ctx, query, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get revenue by period: %w", err)
	}
	defer rows.Close()

	var periods []RevenuePeriod
	for rows.Next() {
		var p RevenuePeriod
		if err := rows.Scan(&p.Period, &p.Amount, &p.Count); err != nil {
			return nil, fmt.Errorf("scan revenue period: %w", err)
		}
		periods = append(periods, p)
	}

	if periods == nil {
		periods = []RevenuePeriod{}
	}

	return periods, nil
}

// GetRevenueByTool returns revenue aggregated by tool name.
func (s *Store) GetRevenueByTool(ctx context.Context, agentDBID uuid.UUID) ([]RevenueByTool, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT COALESCE(tool_name, 'unknown') AS tool_name,
			COALESCE(SUM(amount), 0) AS amount,
			COUNT(*) AS count
		FROM revenue_entries
		WHERE agent_id = $1
		GROUP BY tool_name
		ORDER BY amount DESC
	`, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get revenue by tool: %w", err)
	}
	defer rows.Close()

	var tools []RevenueByTool
	for rows.Next() {
		var t RevenueByTool
		if err := rows.Scan(&t.ToolName, &t.Amount, &t.Count); err != nil {
			return nil, fmt.Errorf("scan revenue by tool: %w", err)
		}
		tools = append(tools, t)
	}

	if tools == nil {
		tools = []RevenueByTool{}
	}

	return tools, nil
}

// VerificationStats holds verification summary for an agent's revenue.
type VerificationStats struct {
	VerifiedCount   int64   `json:"verified_count"`
	UnverifiedCount int64   `json:"unverified_count"`
	VerifiedAmount  float64 `json:"verified_amount"`
}

// GetVerificationStats returns counts and amount of verified vs unverified revenue entries.
func (s *Store) GetVerificationStats(ctx context.Context, agentDBID uuid.UUID) (*VerificationStats, error) {
	stats := &VerificationStats{}
	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN verified = TRUE THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN verified = FALSE OR verified IS NULL THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN verified = TRUE THEN amount ELSE 0 END), 0)
		FROM revenue_entries
		WHERE agent_id = $1
	`, agentDBID).Scan(&stats.VerifiedCount, &stats.UnverifiedCount, &stats.VerifiedAmount)
	if err != nil {
		return nil, fmt.Errorf("get verification stats: %w", err)
	}
	return stats, nil
}

// GetARPU returns the average revenue per unique paying customer.
func (s *Store) GetARPU(ctx context.Context, agentDBID uuid.UUID) (float64, error) {
	var arpu float64
	err := s.pool.QueryRow(ctx, `
		SELECT CASE
			WHEN COUNT(DISTINCT customer_id) > 0
			THEN COALESCE(SUM(amount), 0) / COUNT(DISTINCT customer_id)
			ELSE 0
		END AS arpu
		FROM revenue_entries
		WHERE agent_id = $1 AND customer_id IS NOT NULL
	`, agentDBID).Scan(&arpu)
	if err != nil {
		return 0, fmt.Errorf("get arpu: %w", err)
	}
	return arpu, nil
}
