package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Customer represents a tracked customer for an agent.
type Customer struct {
	ID             uuid.UUID `json:"id"`
	AgentID        uuid.UUID `json:"agent_id"`
	CustomerID     string    `json:"customer_id"`
	FirstSeenAt    time.Time `json:"first_seen_at"`
	LastSeenAt     time.Time `json:"last_seen_at"`
	TotalRequests  int64     `json:"total_requests"`
	TotalRevenue   float64   `json:"total_revenue"`
	AvgResponseMs  float32   `json:"avg_response_ms"`
	ErrorRate      float32   `json:"error_rate"`
	ChurnRisk      string    `json:"churn_risk"`
	Country        string    `json:"country"`
	City           string    `json:"city"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CustomerCohort represents a monthly cohort of customers.
type CustomerCohort struct {
	Month        string `json:"month"`
	NewCustomers int    `json:"new_customers"`
}

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

// GetCustomers returns a paginated list of customers for an agent.
func (s *Store) GetCustomers(ctx context.Context, agentDBID uuid.UUID, limit, offset int) ([]Customer, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM customers WHERE agent_id = $1
	`, agentDBID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count customers: %w", err)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, customer_id, first_seen_at, last_seen_at,
			total_requests, total_revenue, avg_response_ms, error_rate, churn_risk,
			country, city, created_at, updated_at
		FROM customers
		WHERE agent_id = $1
		ORDER BY last_seen_at DESC
		LIMIT $2 OFFSET $3
	`, agentDBID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("get customers: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var c Customer
		if err := rows.Scan(
			&c.ID, &c.AgentID, &c.CustomerID, &c.FirstSeenAt, &c.LastSeenAt,
			&c.TotalRequests, &c.TotalRevenue, &c.AvgResponseMs, &c.ErrorRate, &c.ChurnRisk,
			&c.Country, &c.City, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan customer: %w", err)
		}
		customers = append(customers, c)
	}

	if customers == nil {
		customers = []Customer{}
	}

	return customers, total, nil
}

// GetCustomer returns a single customer by agent and customer ID.
func (s *Store) GetCustomer(ctx context.Context, agentDBID uuid.UUID, customerID string) (*Customer, error) {
	c := &Customer{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, customer_id, first_seen_at, last_seen_at,
			total_requests, total_revenue, avg_response_ms, error_rate, churn_risk,
			country, city, created_at, updated_at
		FROM customers
		WHERE agent_id = $1 AND customer_id = $2
	`, agentDBID, customerID).Scan(
		&c.ID, &c.AgentID, &c.CustomerID, &c.FirstSeenAt, &c.LastSeenAt,
		&c.TotalRequests, &c.TotalRevenue, &c.AvgResponseMs, &c.ErrorRate, &c.ChurnRisk,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get customer: %w", err)
	}
	return c, nil
}

// GetCustomerCohorts returns monthly cohorts grouped by first_seen month.
func (s *Store) GetCustomerCohorts(ctx context.Context, agentDBID uuid.UUID) ([]CustomerCohort, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT to_char(date_trunc('month', first_seen_at), 'YYYY-MM') AS month,
			COUNT(*) AS new_customers
		FROM customers
		WHERE agent_id = $1
		GROUP BY date_trunc('month', first_seen_at)
		ORDER BY date_trunc('month', first_seen_at) DESC
	`, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get customer cohorts: %w", err)
	}
	defer rows.Close()

	var cohorts []CustomerCohort
	for rows.Next() {
		var c CustomerCohort
		if err := rows.Scan(&c.Month, &c.NewCustomers); err != nil {
			return nil, fmt.Errorf("scan customer cohort: %w", err)
		}
		cohorts = append(cohorts, c)
	}

	if cohorts == nil {
		cohorts = []CustomerCohort{}
	}

	return cohorts, nil
}

// UpdateChurnRisk bulk-updates churn risk for all customers of an agent.
// 14+ days inactive = high, 7+ days = medium, else low.
func (s *Store) UpdateChurnRisk(ctx context.Context, agentDBID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE customers
		SET churn_risk = CASE
			WHEN last_seen_at < NOW() - INTERVAL '14 days' THEN 'high'
			WHEN last_seen_at < NOW() - INTERVAL '7 days' THEN 'medium'
			ELSE 'low'
		END,
		updated_at = NOW()
		WHERE agent_id = $1
	`, agentDBID)
	if err != nil {
		return fmt.Errorf("update churn risk: %w", err)
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
