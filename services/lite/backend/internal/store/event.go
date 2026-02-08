package store

import (
	"context"
	"time"
)

type Event struct {
	ID        int64     `json:"id"`
	EventType string    `json:"event_type"`
	ChannelID *string   `json:"channel_id,omitempty"`
	AgentID   *string   `json:"agent_id,omitempty"`
	Payload   []byte    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) ListEvents(ctx context.Context) ([]Event, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, event_type, channel_id, agent_id, payload, created_at
		FROM events
		ORDER BY created_at DESC
		LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		if err := rows.Scan(
			&e.ID, &e.EventType, &e.ChannelID, &e.AgentID, &e.Payload, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}
