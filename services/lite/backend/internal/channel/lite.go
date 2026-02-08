package channel

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// LiteEngine implements Engine using PostgreSQL as the ledger.
// All balance updates are atomic DB transactions — no Hydra, no agent signing.
type LiteEngine struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewLiteEngine(pool *pgxpool.Pool, logger *zap.Logger) *LiteEngine {
	return &LiteEngine{pool: pool, logger: logger}
}

func (e *LiteEngine) CreateChannel(ctx context.Context, req CreateChannelRequest) (*Channel, error) {
	channelID := fmt.Sprintf("ch_%s", uuid.New().String()[:12])
	credits := int64(req.USDCAmount * CreditRatio)
	maxP := req.MaxParticipants
	if maxP == 0 {
		maxP = 10
	}
	chType := req.Type
	if chType == "" {
		chType = "private"
	}

	now := time.Now()

	tx, err := e.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Insert channel
	var dbID string
	err = tx.QueryRow(ctx, `
		INSERT INTO channels (channel_id, mode, type, status, total_usdc_deposited, total_credits_minted, max_participants, opened_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, channelID, ModeLite, chType, StatusActive, req.USDCAmount, credits, maxP, now).Scan(&dbID)
	if err != nil {
		return nil, fmt.Errorf("insert channel: %w", err)
	}

	// Ensure agents exist and create initial credit balances
	creditsPerAgent := credits / int64(len(req.Participants))
	remainder := credits - creditsPerAgent*int64(len(req.Participants))

	for i, agentID := range req.Participants {
		// Upsert agent
		var agentDBID string
		err = tx.QueryRow(ctx, `
			INSERT INTO agents (agent_id) VALUES ($1)
			ON CONFLICT (agent_id) DO UPDATE SET updated_at = NOW()
			RETURNING id
		`, agentID).Scan(&agentDBID)
		if err != nil {
			return nil, fmt.Errorf("upsert agent %s: %w", agentID, err)
		}

		// Add participant
		_, err = tx.Exec(ctx, `
			INSERT INTO channel_participants (channel_id, agent_id, role, cardano_address, cardano_vkey_hash, initial_credits, current_credits, status)
			VALUES ($1, $2, 'client', '', '', $3, $3, 'active')
		`, dbID, agentDBID, creditsPerAgent)
		if err != nil {
			return nil, fmt.Errorf("insert participant: %w", err)
		}

		// Set credit balance (first agent gets remainder)
		bal := creditsPerAgent
		if i == 0 {
			bal += remainder
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO credit_balances (channel_id, agent_id, balance)
			VALUES ($1, $2, $3)
		`, dbID, agentDBID, bal)
		if err != nil {
			return nil, fmt.Errorf("insert balance: %w", err)
		}
	}

	// Record event
	_, err = tx.Exec(ctx, `
		INSERT INTO events (event_type, channel_id, payload)
		VALUES ('channel_created', $1, $2)
	`, dbID, fmt.Sprintf(`{"mode":"lite","usdc":%.6f,"credits":%d,"participants":%d}`, req.USDCAmount, credits, len(req.Participants)))
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &Channel{
		ID:                 dbID,
		ChannelID:          channelID,
		Mode:               ModeLite,
		Type:               chType,
		Status:             StatusActive,
		TotalUSDCDeposited: req.USDCAmount,
		TotalCreditsMinted: credits,
		MaxParticipants:    maxP,
		CreatedAt:          now,
		OpenedAt:           &now,
	}, nil
}

func (e *LiteEngine) GetChannel(ctx context.Context, channelID string) (*Channel, error) {
	ch := &Channel{}
	err := e.pool.QueryRow(ctx, `
		SELECT id, channel_id, mode, type, status, hydra_head_id,
		       total_usdc_deposited, total_credits_minted, total_transactions,
		       avg_latency_ms, max_participants, created_at, opened_at, closed_at
		FROM channels WHERE channel_id = $1
	`, channelID).Scan(
		&ch.ID, &ch.ChannelID, &ch.Mode, &ch.Type, &ch.Status,
		&ch.HydraHeadID, &ch.TotalUSDCDeposited, &ch.TotalCreditsMinted,
		&ch.TotalTransactions, &ch.AvgLatencyMs, &ch.MaxParticipants,
		&ch.CreatedAt, &ch.OpenedAt, &ch.ClosedAt,
	)
	if err != nil {
		return nil, err
	}
	return ch, nil
}

func (e *LiteEngine) SendTransaction(ctx context.Context, channelID string, req TxRequest) (*TxResult, error) {
	start := time.Now()
	txID := fmt.Sprintf("tx_%s", uuid.New().String()[:12])

	tx, err := e.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Resolve channel DB ID
	var chDBID string
	var chStatus string
	err = tx.QueryRow(ctx, `SELECT id, status FROM channels WHERE channel_id = $1`, channelID).Scan(&chDBID, &chStatus)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}
	if chStatus != StatusActive {
		return nil, fmt.Errorf("channel is not active (status: %s)", chStatus)
	}

	// Resolve agent DB IDs
	var fromDBID, toDBID string
	err = tx.QueryRow(ctx, `SELECT id FROM agents WHERE agent_id = $1`, req.From).Scan(&fromDBID)
	if err != nil {
		return nil, fmt.Errorf("sender agent not found: %w", err)
	}
	err = tx.QueryRow(ctx, `SELECT id FROM agents WHERE agent_id = $1`, req.To).Scan(&toDBID)
	if err != nil {
		return nil, fmt.Errorf("receiver agent not found: %w", err)
	}

	// Deduct from sender (with balance check)
	var newBalance int64
	err = tx.QueryRow(ctx, `
		UPDATE credit_balances
		SET balance = balance - $1, updated_at = NOW()
		WHERE channel_id = $2 AND agent_id = $3 AND balance >= $1
		RETURNING balance
	`, req.Amount, chDBID, fromDBID).Scan(&newBalance)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("insufficient balance")
		}
		return nil, fmt.Errorf("deduct balance: %w", err)
	}

	// Credit to receiver
	_, err = tx.Exec(ctx, `
		UPDATE credit_balances
		SET balance = balance + $1, updated_at = NOW()
		WHERE channel_id = $2 AND agent_id = $3
	`, req.Amount, chDBID, toDBID)
	if err != nil {
		return nil, fmt.Errorf("credit balance: %w", err)
	}

	latency := float64(time.Since(start).Microseconds()) / 1000.0

	// Log transaction
	_, err = tx.Exec(ctx, `
		INSERT INTO transaction_log (channel_id, tx_id, from_address, to_address, amount, memo, latency_ms, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
	`, chDBID, txID, req.From, req.To, req.Amount, req.Memo, latency)
	if err != nil {
		return nil, fmt.Errorf("insert tx log: %w", err)
	}

	// Update channel stats
	_, err = tx.Exec(ctx, `
		UPDATE channels
		SET total_transactions = total_transactions + 1,
		    avg_latency_ms = (avg_latency_ms * total_transactions + $1) / (total_transactions + 1)
		WHERE id = $2
	`, latency, chDBID)
	if err != nil {
		return nil, fmt.Errorf("update channel stats: %w", err)
	}

	// Record event
	_, err = tx.Exec(ctx, `
		INSERT INTO events (event_type, channel_id, payload)
		VALUES ('tx_confirmed', $1, $2)
	`, chDBID, fmt.Sprintf(`{"tx_id":"%s","from":"%s","to":"%s","amount":%d,"memo":"%s","latency_ms":%.3f}`,
		txID, req.From, req.To, req.Amount, req.Memo, latency))
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &TxResult{
		TxID:      txID,
		ChannelID: channelID,
		From:      req.From,
		To:        req.To,
		Amount:    req.Amount,
		Memo:      req.Memo,
		Status:    "confirmed",
		LatencyMs: latency,
	}, nil
}

func (e *LiteEngine) TopupCredits(ctx context.Context, channelID string, agentID string, amount int64) error {
	tx, err := e.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Resolve IDs
	var chDBID string
	err = tx.QueryRow(ctx, `SELECT id FROM channels WHERE channel_id = $1 AND status = 'active'`, channelID).Scan(&chDBID)
	if err != nil {
		return fmt.Errorf("active channel not found: %w", err)
	}
	var agentDBID string
	err = tx.QueryRow(ctx, `SELECT id FROM agents WHERE agent_id = $1`, agentID).Scan(&agentDBID)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	usdcAmount := float64(amount) / CreditRatio

	// Update credit balance
	_, err = tx.Exec(ctx, `
		UPDATE credit_balances SET balance = balance + $1, updated_at = NOW()
		WHERE channel_id = $2 AND agent_id = $3
	`, amount, chDBID, agentDBID)
	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Update channel totals
	_, err = tx.Exec(ctx, `
		UPDATE channels
		SET total_usdc_deposited = total_usdc_deposited + $1,
		    total_credits_minted = total_credits_minted + $2
		WHERE id = $3
	`, usdcAmount, amount, chDBID)
	if err != nil {
		return fmt.Errorf("update channel: %w", err)
	}

	// Record event
	_, err = tx.Exec(ctx, `
		INSERT INTO events (event_type, channel_id, payload)
		VALUES ('credits_topped_up', $1, $2)
	`, chDBID, fmt.Sprintf(`{"agent":"%s","credits":%d,"usdc":%.6f}`, agentID, amount, usdcAmount))
	if err != nil {
		return fmt.Errorf("insert event: %w", err)
	}

	return tx.Commit(ctx)
}

func (e *LiteEngine) CloseChannel(ctx context.Context, channelID string) (*Settlement, error) {
	tx, err := e.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get channel
	var chDBID string
	var totalUSDC float64
	var totalTx int64
	err = tx.QueryRow(ctx, `
		SELECT id, total_usdc_deposited, total_transactions
		FROM channels WHERE channel_id = $1 AND status = 'active'
	`, channelID).Scan(&chDBID, &totalUSDC, &totalTx)
	if err != nil {
		return nil, fmt.Errorf("active channel not found: %w", err)
	}

	// Get all balances
	rows, err := tx.Query(ctx, `
		SELECT cb.agent_id, a.agent_id AS agent_name, cb.balance
		FROM credit_balances cb
		JOIN agents a ON a.id = cb.agent_id
		WHERE cb.channel_id = $1
	`, chDBID)
	if err != nil {
		return nil, fmt.Errorf("get balances: %w", err)
	}
	defer rows.Close()

	var totalCredits int64
	balances := make(map[string]int64)
	for rows.Next() {
		var agentDBID, agentName string
		var bal int64
		if err := rows.Scan(&agentDBID, &agentName, &bal); err != nil {
			return nil, err
		}
		balances[agentName] = bal
		totalCredits += bal
	}
	rows.Close()

	// Calculate USDC owed per agent
	usdcOwed := make(map[string]float64)
	for agent, bal := range balances {
		if totalCredits > 0 {
			usdcOwed[agent] = totalUSDC * float64(bal) / float64(totalCredits)
		}
	}

	// Mark channel as settled
	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE channels SET status = 'settled', closed_at = $1, settled_at = $1
		WHERE id = $2
	`, now, chDBID)
	if err != nil {
		return nil, fmt.Errorf("update channel status: %w", err)
	}

	// Record event
	_, err = tx.Exec(ctx, `
		INSERT INTO events (event_type, channel_id, payload)
		VALUES ('channel_settled', $1, $2)
	`, chDBID, fmt.Sprintf(`{"total_usdc":%.6f,"total_tx":%d}`, totalUSDC, totalTx))
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &Settlement{
		ChannelID: channelID,
		Balances:  balances,
		USDCOwed:  usdcOwed,
		TotalUSDC: totalUSDC,
		TotalTx:   totalTx,
	}, nil
}

func (e *LiteEngine) GetBalances(ctx context.Context, channelID string) ([]CreditBalance, error) {
	// Resolve channel DB ID
	var chDBID string
	err := e.pool.QueryRow(ctx, `SELECT id FROM channels WHERE channel_id = $1`, channelID).Scan(&chDBID)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}

	rows, err := e.pool.Query(ctx, `
		SELECT cb.channel_id, a.agent_id, cb.balance
		FROM credit_balances cb
		JOIN agents a ON a.id = cb.agent_id
		WHERE cb.channel_id = $1
	`, chDBID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CreditBalance
	for rows.Next() {
		var cb CreditBalance
		var chID string
		if err := rows.Scan(&chID, &cb.AgentID, &cb.Balance); err != nil {
			return nil, err
		}
		cb.ChannelID = channelID
		result = append(result, cb)
	}
	return result, nil
}
