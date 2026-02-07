package store

import (
	"context"
	"time"
)

type Agent struct {
	ID              string    `json:"id"`
	AgentID         string    `json:"agent_id"`
	EVMAddress      *string   `json:"evm_address,omitempty"`
	ReputationScore *float32  `json:"reputation_score,omitempty"`
	VerifiedAt      *time.Time `json:"verified_at,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

func (s *Store) GetAgent(ctx context.Context, agentID string) (*Agent, error) {
	a := &Agent{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, evm_address, reputation_score, verified_at, created_at
		FROM agents WHERE agent_id = $1
	`, agentID).Scan(
		&a.ID, &a.AgentID, &a.EVMAddress, &a.ReputationScore, &a.VerifiedAt, &a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Store) UpdateAgentEVMAddress(ctx context.Context, agentID, evmAddress string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE agents SET evm_address = $1, verified_at = NOW(), updated_at = NOW()
		WHERE agent_id = $2
	`, evmAddress, agentID)
	return err
}

func (s *Store) ListAgents(ctx context.Context) ([]Agent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, evm_address, reputation_score, verified_at, created_at
		FROM agents ORDER BY created_at DESC LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		var a Agent
		if err := rows.Scan(
			&a.ID, &a.AgentID, &a.EVMAddress, &a.ReputationScore, &a.VerifiedAt, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, nil
}
