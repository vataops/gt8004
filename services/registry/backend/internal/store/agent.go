package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Agent struct {
	ID               uuid.UUID  `json:"id"`
	AgentID          string     `json:"agent_id"`
	Name             string     `json:"name"`
	OriginEndpoint   string     `json:"origin_endpoint"`
	GT8004Endpoint      string     `json:"gt8004_endpoint"`
	Protocols        []string   `json:"protocols"`
	Category         string     `json:"category"`
	PricingModel     string     `json:"pricing_model,omitempty"`
	PricingAmount    float64    `json:"pricing_amount,omitempty"`
	PricingCurrency  string     `json:"pricing_currency,omitempty"`
	GatewayEnabled   bool       `json:"gateway_enabled"`
	Status           string     `json:"status"`
	EVMAddress       string     `json:"evm_address,omitempty"`
	ReputationScore  float64    `json:"reputation_score"`
	TotalRequests    int64      `json:"total_requests"`
	TotalRevenueUSDC float64    `json:"total_revenue_usdc"`
	TotalCustomers   int        `json:"total_customers"`
	AvgResponseMs    float64    `json:"avg_response_ms"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Tier management
	CurrentTier   string     `json:"current_tier"`
	TierUpdatedAt *time.Time `json:"tier_updated_at,omitempty"`

	// ERC-8004 Identity fields (merged from Lite)
	ERC8004TokenID   *int64     `json:"erc8004_token_id,omitempty"`
	ChainID          int        `json:"chain_id"`
	AgentURI         string     `json:"agent_uri,omitempty"`
	Capabilities     []string   `json:"capabilities,omitempty"`
	IdentityRegistry string     `json:"identity_registry,omitempty"`
	VerifiedAt       *time.Time `json:"verified_at,omitempty"`
}

// agentSelectCols is the shared column list used across agent queries.
const agentSelectCols = `
	id, agent_id, name, origin_endpoint, gt8004_endpoint, protocols, category,
	COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
	gateway_enabled, status, COALESCE(evm_address, ''), reputation_score,
	total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
	created_at, updated_at,
	COALESCE(current_tier, 'open'), tier_updated_at,
	erc8004_token_id, COALESCE(chain_id, 0), COALESCE(agent_uri, ''), COALESCE(capabilities, '[]'::jsonb),
	COALESCE(identity_registry, ''), verified_at
`

// scanAgent scans a single agent row into an Agent struct.
func scanAgent(scan func(dest ...any) error) (*Agent, error) {
	a := &Agent{}
	err := scan(
		&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.GT8004Endpoint,
		&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
		&a.GatewayEnabled, &a.Status, &a.EVMAddress, &a.ReputationScore,
		&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
		&a.CreatedAt, &a.UpdatedAt,
		&a.CurrentTier, &a.TierUpdatedAt,
		&a.ERC8004TokenID, &a.ChainID, &a.AgentURI, &a.Capabilities,
		&a.IdentityRegistry, &a.VerifiedAt,
	)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Store) CreateAgent(ctx context.Context, agent *Agent) error {
	if agent.Protocols == nil {
		agent.Protocols = []string{}
	}
	if agent.CurrentTier == "" {
		agent.CurrentTier = "open"
	}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO agents (agent_id, name, origin_endpoint, gt8004_endpoint, protocols, category,
			pricing_model, pricing_currency, status, current_tier,
			erc8004_token_id, chain_id, agent_uri, capabilities, identity_registry,
			evm_address, verified_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at
	`,
		agent.AgentID, agent.Name, agent.OriginEndpoint, agent.GT8004Endpoint,
		agent.Protocols, agent.Category, agent.PricingModel, agent.PricingCurrency,
		agent.Status, agent.CurrentTier,
		agent.ERC8004TokenID, agent.ChainID, agent.AgentURI, agent.Capabilities, agent.IdentityRegistry,
		agent.EVMAddress, agent.VerifiedAt,
	).Scan(&agent.ID, &agent.CreatedAt, &agent.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert agent: %w", err)
	}
	return nil
}

func (s *Store) GetAgentByID(ctx context.Context, agentID string) (*Agent, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+agentSelectCols+` FROM agents WHERE agent_id = $1`, agentID)
	a, err := scanAgent(row.Scan)
	if err != nil {
		return nil, fmt.Errorf("get agent by id: %w", err)
	}
	return a, nil
}

func (s *Store) GetAgentByDBID(ctx context.Context, id uuid.UUID) (*Agent, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+agentSelectCols+` FROM agents WHERE id = $1`, id)
	a, err := scanAgent(row.Scan)
	if err != nil {
		return nil, fmt.Errorf("get agent by db id: %w", err)
	}
	return a, nil
}

func (s *Store) GetAgentByTokenID(ctx context.Context, tokenID int64) (*Agent, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+agentSelectCols+` FROM agents WHERE erc8004_token_id = $1`, tokenID)
	a, err := scanAgent(row.Scan)
	if err != nil {
		return nil, fmt.Errorf("get agent by token id: %w", err)
	}
	return a, nil
}

func (s *Store) LinkERC8004(ctx context.Context, id uuid.UUID, tokenID int64, chainID int, agentURI, registry, evmAddress string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents
		SET erc8004_token_id = $2, chain_id = $3, agent_uri = $4, identity_registry = $5,
			evm_address = $6, verified_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id, tokenID, chainID, agentURI, registry, evmAddress)
	if err != nil {
		return fmt.Errorf("link erc8004: %w", err)
	}
	return nil
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
		UPDATE agents SET evm_address = $1, verified_at = NOW(), updated_at = NOW()
		WHERE agent_id = $2
	`, evmAddress, agentID)
	return err
}

func (s *Store) SearchAgents(ctx context.Context, category, protocol string) ([]Agent, error) {
	query := `SELECT ` + agentSelectCols + ` FROM agents WHERE status = 'active'`
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
		a, err := scanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, *a)
	}

	if agents == nil {
		agents = []Agent{}
	}

	return agents, nil
}

// SearchAgentsAdvanced extends SearchAgents with additional filtering and sorting options.
func (s *Store) SearchAgentsAdvanced(ctx context.Context, category, protocol string, minReputation float64, sortBy string) ([]Agent, error) {
	query := `SELECT ` + agentSelectCols + ` FROM agents WHERE status = 'active'`
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
	switch sortBy {
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
		a, err := scanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, *a)
	}

	if agents == nil {
		agents = []Agent{}
	}

	return agents, nil
}

// UpdateTier sets the current tier for an agent and records the time of change.
func (s *Store) UpdateTier(ctx context.Context, id uuid.UUID, tier string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents
		SET current_tier = $2, tier_updated_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id, tier)
	if err != nil {
		return fmt.Errorf("update tier: %w", err)
	}
	return nil
}


// UpdateOriginEndpoint updates the origin endpoint for an agent.
func (s *Store) UpdateOriginEndpoint(ctx context.Context, id uuid.UUID, endpoint string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET origin_endpoint = $1, updated_at = NOW()
		WHERE id = $2
	`, endpoint, id)
	if err != nil {
		return fmt.Errorf("update origin endpoint: %w", err)
	}
	return nil
}

// GetAgentsByEVMAddress returns all agents linked to a given EVM wallet address.
func (s *Store) GetAgentsByEVMAddress(ctx context.Context, evmAddress string) ([]Agent, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+agentSelectCols+` FROM agents WHERE LOWER(evm_address) = LOWER($1) AND status = 'active'`, evmAddress)
	if err != nil {
		return nil, fmt.Errorf("get agents by evm address: %w", err)
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		a, err := scanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, *a)
	}
	return agents, nil
}

// DeregisterAgent marks an agent as deregistered by setting its status to 'deregistered'
// and disabling the gateway.
func (s *Store) DeregisterAgent(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents
		SET status = 'deregistered', gateway_enabled = FALSE, updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("deregister agent: %w", err)
	}
	return nil
}

// UpdateAgentTotalCustomers updates the total_customers count on the agents table.
func (s *Store) UpdateAgentTotalCustomers(ctx context.Context, agentDBID uuid.UUID, count int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET total_customers = $2, updated_at = NOW() WHERE id = $1
	`, agentDBID, count)
	if err != nil {
		return fmt.Errorf("update agent total customers: %w", err)
	}
	return nil
}

// DashboardOverview contains overview data for admin.
type DashboardOverview struct {
	TotalAgents      int     `json:"total_agents"`
	ActiveAgents     int     `json:"active_agents"`
	TotalRequests    int64   `json:"total_requests"`
	TotalRevenueUSDC float64 `json:"total_revenue_usdc"`
	AvgResponseMs    float64 `json:"avg_response_ms"`
}

func (s *Store) GetDashboardOverview(ctx context.Context) (*DashboardOverview, error) {
	o := &DashboardOverview{}

	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS total_agents,
			COUNT(*) FILTER (WHERE status = 'active') AS active_agents,
			COALESCE(SUM(total_requests), 0) AS total_requests,
			COALESCE(SUM(total_revenue_usdc), 0) AS total_revenue_usdc,
			COALESCE(AVG(avg_response_ms), 0) AS avg_response_ms
		FROM agents
	`).Scan(&o.TotalAgents, &o.ActiveAgents, &o.TotalRequests, &o.TotalRevenueUSDC, &o.AvgResponseMs)
	if err != nil {
		return nil, fmt.Errorf("get dashboard overview: %w", err)
	}

	return o, nil
}
