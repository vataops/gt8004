package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// RevenueEntry represents a single revenue event.
type RevenueEntry struct {
	AgentID      uuid.UUID
	CustomerID   *string
	ToolName     *string
	Amount       float64
	Currency     string
	TxHash       *string
	PayerAddress *string
}

// InsertRevenueEntry inserts a single revenue entry.
func (s *Store) InsertRevenueEntry(ctx context.Context, entry RevenueEntry) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO revenue_entries (agent_id, customer_id, tool_name, amount, currency, tx_hash, payer_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, entry.AgentID, entry.CustomerID, entry.ToolName, entry.Amount, entry.Currency, entry.TxHash, entry.PayerAddress)
	if err != nil {
		return fmt.Errorf("insert revenue entry: %w", err)
	}
	return nil
}
