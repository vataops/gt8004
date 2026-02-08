package store

import (
	"context"
	"time"
)

type TransactionLog struct {
	ID          int64     `json:"id"`
	ChannelID   string    `json:"channel_id"`
	TxID        *string   `json:"tx_id,omitempty"`
	FromAddress *string   `json:"from_address,omitempty"`
	ToAddress   *string   `json:"to_address,omitempty"`
	Amount      int64     `json:"amount"`
	Memo        *string   `json:"memo,omitempty"`
	LatencyMs   *float32  `json:"latency_ms,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

func (s *Store) ListTransactionsByChannel(ctx context.Context, channelID string) ([]TransactionLog, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT tl.id, c.channel_id, tl.tx_id, tl.from_address, tl.to_address,
		       tl.amount, tl.memo, tl.latency_ms, tl.status, tl.created_at
		FROM transaction_log tl
		JOIN channels c ON c.id = tl.channel_id
		WHERE c.channel_id = $1
		ORDER BY tl.created_at DESC
		LIMIT 200
	`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []TransactionLog
	for rows.Next() {
		var tx TransactionLog
		if err := rows.Scan(
			&tx.ID, &tx.ChannelID, &tx.TxID, &tx.FromAddress, &tx.ToAddress,
			&tx.Amount, &tx.Memo, &tx.LatencyMs, &tx.Status, &tx.CreatedAt,
		); err != nil {
			return nil, err
		}
		txs = append(txs, tx)
	}
	return txs, nil
}
