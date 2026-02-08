package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Agent struct {
	ID               uuid.UUID `json:"id"`
	AgentID          string    `json:"agent_id"`
	Name             string    `json:"name"`
	OriginEndpoint   string    `json:"origin_endpoint"`
	AESEndpoint      string    `json:"aes_endpoint"`
	Protocols        []string  `json:"protocols"`
	Category         string    `json:"category"`
	PricingModel     string    `json:"pricing_model,omitempty"`
	PricingAmount    float64   `json:"pricing_amount,omitempty"`
	PricingCurrency  string    `json:"pricing_currency,omitempty"`
	GatewayEnabled   bool      `json:"gateway_enabled"`
	Status           string    `json:"status"`
	EVMAddress       string    `json:"evm_address,omitempty"`
	ReputationScore  float64   `json:"reputation_score"`
	TotalRequests    int64     `json:"total_requests"`
	TotalRevenueUSDC float64   `json:"total_revenue_usdc"`
	TotalCustomers   int       `json:"total_customers"`
	AvgResponseMs    float64   `json:"avg_response_ms"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (s *Store) CreateAgent(ctx context.Context, agent *Agent) error {
	if agent.Protocols == nil {
		agent.Protocols = []string{}
	}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO agents (agent_id, name, origin_endpoint, aes_endpoint, protocols, category,
			pricing_model, pricing_currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`,
		agent.AgentID, agent.Name, agent.OriginEndpoint, agent.AESEndpoint,
		agent.Protocols, agent.Category, agent.PricingModel, agent.PricingCurrency,
		agent.Status,
	).Scan(&agent.ID, &agent.CreatedAt, &agent.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert agent: %w", err)
	}
	return nil
}

func (s *Store) GetAgentByID(ctx context.Context, agentID string) (*Agent, error) {
	a := &Agent{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, name, origin_endpoint, aes_endpoint, protocols, category,
			COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
			gateway_enabled, status, COALESCE(evm_address, ''), reputation_score,
			total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
			created_at, updated_at
		FROM agents WHERE agent_id = $1
	`, agentID).Scan(
		&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.AESEndpoint,
		&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
		&a.GatewayEnabled, &a.Status, &a.EVMAddress, &a.ReputationScore,
		&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get agent by id: %w", err)
	}
	return a, nil
}

func (s *Store) GetAgentByDBID(ctx context.Context, id uuid.UUID) (*Agent, error) {
	a := &Agent{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, name, origin_endpoint, aes_endpoint, protocols, category,
			COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
			gateway_enabled, status, COALESCE(evm_address, ''), reputation_score,
			total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
			created_at, updated_at
		FROM agents WHERE id = $1
	`, id).Scan(
		&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.AESEndpoint,
		&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
		&a.GatewayEnabled, &a.Status, &a.EVMAddress, &a.ReputationScore,
		&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get agent by db id: %w", err)
	}
	return a, nil
}

func (s *Store) UpdateAgentStats(ctx context.Context, id uuid.UUID, requests int, revenue float64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents
		SET total_requests = total_requests + $2,
			total_revenue_usdc = total_revenue_usdc + $3,
			updated_at = NOW()
		WHERE id = $1
	`, id, requests, revenue)
	if err != nil {
		return fmt.Errorf("update agent stats: %w", err)
	}
	return nil
}

// SetGatewayEnabled enables or disables the gateway for an agent.
func (s *Store) SetGatewayEnabled(ctx context.Context, id uuid.UUID, enabled bool) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET gateway_enabled = $1, updated_at = NOW()
		WHERE id = $2
	`, enabled, id)
	if err != nil {
		return fmt.Errorf("set gateway enabled: %w", err)
	}
	return nil
}

func (s *Store) SaveAgentEVMAddress(ctx context.Context, agentID, evmAddress string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET evm_address = $1, updated_at = NOW()
		WHERE agent_id = $2
	`, evmAddress, agentID)
	return err
}

func (s *Store) SearchAgents(ctx context.Context, category, protocol string) ([]Agent, error) {
	query := `
		SELECT id, agent_id, name, origin_endpoint, aes_endpoint, protocols, category,
			COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
			gateway_enabled, status, COALESCE(evm_address, ''), reputation_score,
			total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
			created_at, updated_at
		FROM agents
		WHERE status = 'active'
	`
	args := []interface{}{}
	argIdx := 1

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	if protocol != "" {
		query += fmt.Sprintf(" AND $%d = ANY(protocols)", argIdx)
		args = append(args, protocol)
		argIdx++
	}

	query += " ORDER BY reputation_score DESC, total_requests DESC LIMIT 100"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("search agents: %w", err)
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		var a Agent
		if err := rows.Scan(
			&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.AESEndpoint,
			&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
			&a.GatewayEnabled, &a.Status, &a.EVMAddress, &a.ReputationScore,
			&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, a)
	}

	if agents == nil {
		agents = []Agent{}
	}

	return agents, nil
}

// SearchAgentsAdvanced extends SearchAgents with additional filtering and sorting options.
func (s *Store) SearchAgentsAdvanced(ctx context.Context, category, protocol string, minReputation float64, sort string) ([]Agent, error) {
	query := `
		SELECT id, agent_id, name, origin_endpoint, aes_endpoint, protocols, category,
			COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
			gateway_enabled, status, COALESCE(evm_address, ''), reputation_score,
			total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
			created_at, updated_at
		FROM agents
		WHERE status = 'active'
	`
	args := []interface{}{}
	argIdx := 1

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	if protocol != "" {
		query += fmt.Sprintf(" AND $%d = ANY(protocols)", argIdx)
		args = append(args, protocol)
		argIdx++
	}
	if minReputation > 0 {
		query += fmt.Sprintf(" AND reputation_score >= $%d", argIdx)
		args = append(args, minReputation)
		argIdx++
	}

	// Determine sort order.
	switch sort {
	case "requests":
		query += " ORDER BY total_requests DESC"
	case "revenue":
		query += " ORDER BY total_revenue_usdc DESC"
	case "response_time":
		query += " ORDER BY avg_response_ms ASC"
	case "newest":
		query += " ORDER BY created_at DESC"
	default:
		// "reputation" or empty defaults to reputation_score DESC.
		query += " ORDER BY reputation_score DESC, total_requests DESC"
	}

	query += " LIMIT 100"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("search agents advanced: %w", err)
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		var a Agent
		if err := rows.Scan(
			&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.AESEndpoint,
			&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
			&a.GatewayEnabled, &a.Status, &a.EVMAddress, &a.ReputationScore,
			&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, a)
	}

	if agents == nil {
		agents = []Agent{}
	}

	return agents, nil
}
