package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// APIKeyAuth holds the result of API key validation.
type APIKeyAuth struct {
	AgentDBID uuid.UUID
	AgentID   string
	ChainID   int
}

// ValidateAPIKey looks up an API key by its SHA-256 hash and returns agent info.
func (s *Store) ValidateAPIKey(ctx context.Context, keyHash string) (*APIKeyAuth, error) {
	auth := &APIKeyAuth{}
	err := s.pool.QueryRow(ctx, `
		SELECT ak.agent_id, a.agent_id, COALESCE(a.chain_id, 0)
		FROM api_keys ak
		JOIN agents a ON a.id = ak.agent_id
		WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL
	`, keyHash).Scan(&auth.AgentDBID, &auth.AgentID, &auth.ChainID)
	if err != nil {
		return nil, fmt.Errorf("validate api key: %w", err)
	}

	// Update last_used_at
	_, _ = s.pool.Exec(ctx, `
		UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1
	`, keyHash)

	return auth, nil
}

// Agent holds the fields needed by the gateway proxy.
type Agent struct {
	ID             uuid.UUID
	AgentID        string
	Name           string
	OriginEndpoint string
	GatewayEnabled bool
	ChainID        int
}

// GetAgentBySlug resolves an agent slug to its full record for proxying.
func (s *Store) GetAgentBySlug(ctx context.Context, slug string) (*Agent, error) {
	a := &Agent{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, name, origin_endpoint, gateway_enabled, COALESCE(chain_id, 0)
		FROM agents
		WHERE agent_id = $1 AND status = 'active'
	`, slug).Scan(&a.ID, &a.AgentID, &a.Name, &a.OriginEndpoint, &a.GatewayEnabled, &a.ChainID)
	if err != nil {
		return nil, fmt.Errorf("get agent by slug: %w", err)
	}
	return a, nil
}

// UpdateAgentStats increments request count and revenue on the agents table.
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

// UpdateAgentSDKConnected sets the sdk_connected_at timestamp on the agents table.
func (s *Store) UpdateAgentSDKConnected(ctx context.Context, agentDBID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET sdk_connected_at = NOW(), updated_at = NOW() WHERE id = $1
	`, agentDBID)
	if err != nil {
		return fmt.Errorf("update agent sdk connected: %w", err)
	}
	return nil
}
