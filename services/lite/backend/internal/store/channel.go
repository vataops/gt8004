package store

import (
	"context"
	"time"
)

type Channel struct {
	ID                  string     `json:"id"`
	ChannelID           string     `json:"channel_id"`
	Type                string     `json:"type"`
	Status              string     `json:"status"`
	Mode                string     `json:"mode"`
	TotalUSDCDeposited  float64    `json:"total_usdc_deposited"`
	TotalCreditsMinted  int64      `json:"total_credits_minted"`
	TotalTransactions   int64      `json:"total_transactions"`
	AvgLatencyMs        float32    `json:"avg_latency_ms"`
	ParticipantCount    int        `json:"participant_count,omitempty"`
	MaxParticipants     int        `json:"max_participants"`
	CreatedAt           time.Time  `json:"created_at"`
	OpenedAt            *time.Time `json:"opened_at,omitempty"`
	ClosedAt            *time.Time `json:"closed_at,omitempty"`
}

func (s *Store) GetChannel(ctx context.Context, channelID string) (*Channel, error) {
	ch := &Channel{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, channel_id, type, status, mode,
		       total_usdc_deposited, total_credits_minted, total_transactions,
		       avg_latency_ms, max_participants, created_at, opened_at, closed_at
		FROM channels WHERE channel_id = $1
	`, channelID).Scan(
		&ch.ID, &ch.ChannelID, &ch.Type, &ch.Status, &ch.Mode,
		&ch.TotalUSDCDeposited, &ch.TotalCreditsMinted,
		&ch.TotalTransactions, &ch.AvgLatencyMs, &ch.MaxParticipants,
		&ch.CreatedAt, &ch.OpenedAt, &ch.ClosedAt,
	)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (s *Store) ListChannels(ctx context.Context) ([]Channel, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.channel_id, c.type, c.status, c.mode,
		       c.total_usdc_deposited, c.total_credits_minted, c.total_transactions,
		       c.avg_latency_ms, c.max_participants, c.created_at, c.opened_at, c.closed_at,
		       (SELECT COUNT(*) FROM channel_participants cp WHERE cp.channel_id = c.id) as participant_count
		FROM channels c
		ORDER BY c.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(
			&ch.ID, &ch.ChannelID, &ch.Type, &ch.Status, &ch.Mode,
			&ch.TotalUSDCDeposited, &ch.TotalCreditsMinted,
			&ch.TotalTransactions, &ch.AvgLatencyMs, &ch.MaxParticipants,
			&ch.CreatedAt, &ch.OpenedAt, &ch.ClosedAt, &ch.ParticipantCount,
		); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}
