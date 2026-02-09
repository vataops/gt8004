package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// NetworkAgent represents an ERC-8004 token discovered on-chain.
type NetworkAgent struct {
	ID           uuid.UUID `json:"id"`
	ChainID      int       `json:"chain_id"`
	TokenID      int64     `json:"token_id"`
	OwnerAddress string    `json:"owner_address"`
	AgentURI     string    `json:"agent_uri"`
	CreatedAt    time.Time `json:"created_at"`
	SyncedAt     time.Time `json:"synced_at"`
}

// UpsertNetworkAgent inserts or updates a network agent record.
func (s *Store) UpsertNetworkAgent(ctx context.Context, agent *NetworkAgent) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO network_agents (chain_id, token_id, owner_address, agent_uri, synced_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (chain_id, token_id) DO UPDATE SET
			owner_address = EXCLUDED.owner_address,
			agent_uri     = EXCLUDED.agent_uri,
			synced_at     = NOW()
	`, agent.ChainID, agent.TokenID, agent.OwnerAddress, agent.AgentURI)
	if err != nil {
		return fmt.Errorf("upsert network agent: %w", err)
	}
	return nil
}

// ListNetworkAgents returns network agents with optional chain filter and search.
func (s *Store) ListNetworkAgents(ctx context.Context, chainID int, search string, limit, offset int) ([]NetworkAgent, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if chainID > 0 {
		where += fmt.Sprintf(" AND chain_id = $%d", argIdx)
		args = append(args, chainID)
		argIdx++
	}
	if search != "" {
		where += fmt.Sprintf(" AND (owner_address ILIKE $%d OR agent_uri ILIKE $%d OR token_id::text = $%d)", argIdx, argIdx, argIdx+1)
		args = append(args, "%"+search+"%", search)
		argIdx += 2
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) FROM network_agents " + where
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count network agents: %w", err)
	}

	// Fetch rows
	query := "SELECT id, chain_id, token_id, COALESCE(owner_address, ''), COALESCE(agent_uri, ''), created_at, synced_at FROM network_agents " +
		where + fmt.Sprintf(" ORDER BY token_id ASC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list network agents: %w", err)
	}
	defer rows.Close()

	agents := []NetworkAgent{}
	for rows.Next() {
		var a NetworkAgent
		if err := rows.Scan(&a.ID, &a.ChainID, &a.TokenID, &a.OwnerAddress, &a.AgentURI, &a.CreatedAt, &a.SyncedAt); err != nil {
			return nil, 0, fmt.Errorf("scan network agent: %w", err)
		}
		agents = append(agents, a)
	}

	return agents, total, nil
}

// NetworkAgentStats holds aggregate stats for network agents.
type NetworkAgentStats struct {
	Total   int            `json:"total"`
	ByChain map[int]int    `json:"by_chain"`
}

// GetNetworkAgentStats returns aggregate counts.
func (s *Store) GetNetworkAgentStats(ctx context.Context) (*NetworkAgentStats, error) {
	stats := &NetworkAgentStats{ByChain: make(map[int]int)}

	// Total count
	if err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM network_agents").Scan(&stats.Total); err != nil {
		return nil, fmt.Errorf("count network agents: %w", err)
	}

	// Per-chain counts
	rows, err := s.pool.Query(ctx, "SELECT chain_id, COUNT(*) FROM network_agents GROUP BY chain_id")
	if err != nil {
		return nil, fmt.Errorf("count network agents by chain: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var chainID, count int
		if err := rows.Scan(&chainID, &count); err != nil {
			return nil, fmt.Errorf("scan chain count: %w", err)
		}
		stats.ByChain[chainID] = count
	}

	return stats, nil
}
