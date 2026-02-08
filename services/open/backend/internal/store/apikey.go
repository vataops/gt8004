package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
)

type AgentAuth struct {
	AgentDBID uuid.UUID
	AgentID   string
}

// CreateAPIKey generates a new API key for an agent.
// Returns the raw key (only shown once). The SHA-256 hash is stored in the database.
func (s *Store) CreateAPIKey(ctx context.Context, agentDBID uuid.UUID) (string, error) {
	// Generate 32 random bytes
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}

	rawKey := "aes_sk_" + hex.EncodeToString(b)
	keyPrefix := rawKey[:16]

	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	_, err := s.pool.Exec(ctx, `
		INSERT INTO api_keys (agent_id, key_hash, key_prefix)
		VALUES ($1, $2, $3)
	`, agentDBID, keyHash, keyPrefix)
	if err != nil {
		return "", fmt.Errorf("insert api key: %w", err)
	}

	return rawKey, nil
}

// ValidateAPIKey looks up an API key by its SHA-256 hash and returns agent info.
func (s *Store) ValidateAPIKey(ctx context.Context, keyHash string) (*AgentAuth, error) {
	auth := &AgentAuth{}
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
