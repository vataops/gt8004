package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Agent is the full agent struct used by benchmark calculations.
// Analytics has read access to the shared agents table.
type Agent struct {
	ID               uuid.UUID  `json:"id"`
	AgentID          string     `json:"agent_id"`
	Name             string     `json:"name"`
	OriginEndpoint   string     `json:"origin_endpoint"`
	GT8004Endpoint   string     `json:"gt8004_endpoint"`
	Protocols        []string   `json:"protocols"`
	Category         string     `json:"category"`
	PricingModel     string     `json:"pricing_model,omitempty"`
	PricingAmount    float64    `json:"pricing_amount,omitempty"`
	PricingCurrency  string     `json:"pricing_currency,omitempty"`
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

	// ERC-8004 Identity fields
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
	status, COALESCE(evm_address, ''), reputation_score,
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
		&a.Status, &a.EVMAddress, &a.ReputationScore,
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

// GetAgentByDBID returns the full agent by its database UUID.
func (s *Store) GetAgentByDBID(ctx context.Context, id uuid.UUID) (*Agent, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+agentSelectCols+` FROM agents WHERE id = $1`, id)
	a, err := scanAgent(row.Scan)
	if err != nil {
		return nil, fmt.Errorf("get agent by db id: %w", err)
	}
	return a, nil
}

// AgentRef is a minimal struct for slug-to-UUID resolution.
type AgentRef struct {
	ID      uuid.UUID `json:"id"`
	AgentID string    `json:"agent_id"`
}

// GetAgentByID resolves an agent slug to its database UUID.
// Read-only access to the shared agents table.
func (s *Store) GetAgentByID(ctx context.Context, agentID string) (*AgentRef, error) {
	var a AgentRef
	err := s.pool.QueryRow(ctx, `SELECT id, agent_id FROM agents WHERE agent_id = $1 AND status = 'active'`, agentID).Scan(&a.ID, &a.AgentID)
	if err != nil {
		return nil, fmt.Errorf("get agent by id: %w", err)
	}
	return &a, nil
}

// UpdateAgentStats increments request count and revenue on the shared agents table.
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

// GetAgentDBIDsByEVMAddress returns DB IDs of active agents owned by a wallet address.
func (s *Store) GetAgentDBIDsByEVMAddress(ctx context.Context, evmAddress string) ([]uuid.UUID, []int, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, COALESCE(chain_id, 0)
		FROM agents
		WHERE LOWER(evm_address) = LOWER($1) AND status = 'active'
	`, evmAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("get agent db ids by evm address: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	var chains []int
	for rows.Next() {
		var id uuid.UUID
		var chainID int
		if err := rows.Scan(&id, &chainID); err != nil {
			return nil, nil, fmt.Errorf("scan agent id: %w", err)
		}
		ids = append(ids, id)
		chains = append(chains, chainID)
	}
	return ids, chains, nil
}

// GetAgentEVMAddress resolves agent slug to its DB UUID and owner EVM address.
func (s *Store) GetAgentEVMAddress(ctx context.Context, agentID string) (uuid.UUID, string, error) {
	var dbID uuid.UUID
	var evmAddr string
	err := s.pool.QueryRow(ctx, `
		SELECT id, COALESCE(evm_address, '')
		FROM agents WHERE agent_id = $1 AND status = 'active'
	`, agentID).Scan(&dbID, &evmAddr)
	if err != nil {
		return uuid.UUID{}, "", fmt.Errorf("get agent evm address: %w", err)
	}
	return dbID, evmAddr, nil
}

// ---------- Benchmark-related agent queries ----------

// GetActiveAgentsByCategory returns all active agents for a given category.
func (s *Store) GetActiveAgentsByCategory(ctx context.Context, category string) ([]Agent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, name, origin_endpoint, gt8004_endpoint, protocols, category,
			COALESCE(pricing_model, ''), COALESCE(pricing_amount, 0), COALESCE(pricing_currency, 'USDC'),
			status, COALESCE(evm_address, ''), reputation_score,
			total_requests, COALESCE(total_revenue_usdc, 0), total_customers, avg_response_ms,
			COALESCE(current_tier, 'open') AS current_tier,
			created_at, updated_at
		FROM agents
		WHERE status = 'active' AND category = $1
	`, category)
	if err != nil {
		return nil, fmt.Errorf("get active agents by category: %w", err)
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		var a Agent
		if err := rows.Scan(
			&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.GT8004Endpoint,
			&a.Protocols, &a.Category, &a.PricingModel, &a.PricingAmount, &a.PricingCurrency,
			&a.Status, &a.EVMAddress, &a.ReputationScore,
			&a.TotalRequests, &a.TotalRevenueUSDC, &a.TotalCustomers, &a.AvgResponseMs,
			&a.CurrentTier,
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

// GetDistinctAgentCategories returns all distinct categories from the agents table.
func (s *Store) GetDistinctAgentCategories(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT category FROM agents WHERE status = 'active' AND category != '' ORDER BY category
	`)
	if err != nil {
		return nil, fmt.Errorf("get distinct agent categories: %w", err)
	}
	defer rows.Close()

	var categories []string
	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		categories = append(categories, cat)
	}

	if categories == nil {
		categories = []string{}
	}

	return categories, nil
}

// ---------- API Key Validation ----------

// APIKeyAuth holds the result of API key validation.
type APIKeyAuth struct {
	AgentDBID uuid.UUID
	AgentID   string
}

// ValidateAPIKey looks up an API key by its SHA-256 hash and returns agent info.
// Read-only access to the shared api_keys and agents tables.
func (s *Store) ValidateAPIKey(ctx context.Context, keyHash string) (*APIKeyAuth, error) {
	auth := &APIKeyAuth{}
	err := s.pool.QueryRow(ctx, `
		SELECT ak.agent_id, a.agent_id
		FROM api_keys ak
		JOIN agents a ON a.id = ak.agent_id
		WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL
	`, keyHash).Scan(&auth.AgentDBID, &auth.AgentID)
	if err != nil {
		return nil, fmt.Errorf("validate api key: %w", err)
	}

	// Update last_used_at
	_, _ = s.pool.Exec(ctx, `
		UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1
	`, keyHash)

	return auth, nil
}

// SearchAgents returns all active agents (used by admin overview).
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
