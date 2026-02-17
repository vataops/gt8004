package store

import (
	"context"
	"fmt"
	"time"
)

// SaveChallenge persists a challenge to PostgreSQL.
func (s *Store) SaveChallenge(ctx context.Context, challengeHex, agentID string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO challenges (challenge, agent_id, expires_at) VALUES ($1, $2, $3)`,
		challengeHex, agentID, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("save challenge: %w", err)
	}
	return nil
}

// ConsumeChallenge atomically retrieves and deletes a challenge.
func (s *Store) ConsumeChallenge(ctx context.Context, challengeHex string) (string, time.Time, error) {
	var agentID string
	var expiresAt time.Time
	err := s.pool.QueryRow(ctx,
		`DELETE FROM challenges WHERE challenge = $1 RETURNING agent_id, expires_at`,
		challengeHex,
	).Scan(&agentID, &expiresAt)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("challenge not found or already used")
	}
	return agentID, expiresAt, nil
}

// CleanupExpiredChallenges removes expired challenges from the database.
func (s *Store) CleanupExpiredChallenges(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM challenges WHERE expires_at < NOW()`)
	return err
}
