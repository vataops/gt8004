package store

import (
	"context"
	"fmt"
	"time"

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

// InsertRevenueEntryReturningID inserts a revenue entry and returns the generated ID.
func (s *Store) InsertRevenueEntryReturningID(ctx context.Context, entry RevenueEntry) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO revenue_entries (agent_id, customer_id, tool_name, amount, currency, tx_hash, payer_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, entry.AgentID, entry.CustomerID, entry.ToolName, entry.Amount, entry.Currency, entry.TxHash, entry.PayerAddress).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert revenue entry returning id: %w", err)
	}
	return id, nil
}

// IsTxHashAlreadyVerified returns true if the given tx_hash has already been
// verified in another revenue_entry. This prevents the same on-chain transaction
// from being counted multiple times.
func (s *Store) IsTxHashAlreadyVerified(ctx context.Context, txHash string, excludeEntryID int64) (bool, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM revenue_entries
		WHERE tx_hash = $1 AND verified = TRUE AND id != $2
	`, txHash, excludeEntryID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check tx_hash already verified: %w", err)
	}
	return count > 0, nil
}

// UpdateRevenueVerified updates the verification status of a revenue entry.
func (s *Store) UpdateRevenueVerified(ctx context.Context, entryID int64, verified bool, chainID int, verifiedAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE revenue_entries
		SET verified = $2, chain_id = $3, verified_at = $4
		WHERE id = $1
	`, entryID, verified, chainID, verifiedAt)
	if err != nil {
		return fmt.Errorf("update revenue verified: %w", err)
	}
	return nil
}

// UpdateRevenueVerifiedAndIncrAgentRevenue atomically marks a revenue entry as
// verified and increments agents.total_revenue_usdc by the verified amount.
// This ensures revenue is only counted after on-chain confirmation.
func (s *Store) UpdateRevenueVerifiedAndIncrAgentRevenue(ctx context.Context, entryID int64, chainID int, verifiedAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		WITH updated AS (
			UPDATE revenue_entries
			SET verified = true, chain_id = $2, verified_at = $3
			WHERE id = $1
			RETURNING agent_id, amount
		)
		UPDATE agents
		SET total_revenue_usdc = total_revenue_usdc + updated.amount,
			updated_at = NOW()
		FROM updated
		WHERE agents.id = updated.agent_id
	`, entryID, chainID, verifiedAt)
	if err != nil {
		return fmt.Errorf("update revenue verified and incr agent revenue: %w", err)
	}
	return nil
}
