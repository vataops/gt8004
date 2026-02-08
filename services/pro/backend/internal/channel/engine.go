package channel

import (
	"context"
	"time"
)

// Channel represents a Hydra-based payment channel.
type Channel struct {
	ID                 string     `json:"id"`
	ChannelID          string     `json:"channel_id"`
	Mode               string     `json:"mode"` // always "pro"
	Type               string     `json:"type"`
	Status             string     `json:"status"`
	HydraHeadID        string     `json:"hydra_head_id"`
	TotalUSDCDeposited float64    `json:"total_usdc_deposited"`
	TotalCreditsMinted int64      `json:"total_credits_minted"`
	TotalTransactions  int64      `json:"total_transactions"`
	AvgLatencyMs       float32    `json:"avg_latency_ms"`
	MaxParticipants    int        `json:"max_participants"`
	CreatedAt          time.Time  `json:"created_at"`
	OpenedAt           *time.Time `json:"opened_at,omitempty"`
	ClosedAt           *time.Time `json:"closed_at,omitempty"`
}

// CreateChannelRequest for Pro mode channels.
type CreateChannelRequest struct {
	Mode            string   `json:"mode"`
	Type            string   `json:"type"`
	Participants    []string `json:"participants" binding:"required,min=1"`
	USDCAmount      float64  `json:"usdc_amount" binding:"required,gt=0"`
	MaxParticipants int      `json:"max_participants"`
}

// TxRequest is a transaction request.
type TxRequest struct {
	From   string `json:"from" binding:"required"`
	To     string `json:"to" binding:"required"`
	Amount int64  `json:"amount" binding:"required,gt=0"`
	Memo   string `json:"memo"`
}

// TxResult — Pro mode returns unsigned tx for agent to sign.
type TxResult struct {
	TxID       string  `json:"tx_id"`
	ChannelID  string  `json:"channel_id"`
	From       string  `json:"from"`
	To         string  `json:"to"`
	Amount     int64   `json:"amount"`
	Memo       string  `json:"memo"`
	Status     string  `json:"status"` // "pending_signature" or "confirmed"
	LatencyMs  float64 `json:"latency_ms"`
	UnsignedTx []byte  `json:"unsigned_tx,omitempty"`
}

// SubmitSignedTxRequest is for submitting signed transactions.
type SubmitSignedTxRequest struct {
	TxHash    string `json:"tx_hash" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

// Settlement contains the final settlement data.
type Settlement struct {
	ChannelID  string             `json:"channel_id"`
	Balances   map[string]int64   `json:"balances"`
	USDCOwed   map[string]float64 `json:"usdc_owed"`
	TotalUSDC  float64            `json:"total_usdc"`
	TotalTx    int64              `json:"total_transactions"`
}

// CreditBalance represents an agent's CREDIT token balance (on-chain).
type CreditBalance struct {
	ChannelID string `json:"channel_id"`
	AgentID   string `json:"agent_id"`
	Balance   int64  `json:"balance"`
}

// Engine defines the interface for Pro mode channel operations.
type Engine interface {
	CreateChannel(ctx context.Context, req CreateChannelRequest) (*Channel, error)
	GetChannel(ctx context.Context, channelID string) (*Channel, error)
	SendTransaction(ctx context.Context, channelID string, req TxRequest) (*TxResult, error)
	SubmitSignedTx(ctx context.Context, channelID string, req SubmitSignedTxRequest) (*TxResult, error)
	TopupCredits(ctx context.Context, channelID string, agentID string, amount int64) error
	CloseChannel(ctx context.Context, channelID string) (*Settlement, error)
	GetBalances(ctx context.Context, channelID string) ([]CreditBalance, error)
}

const (
	ModePro = "pro"

	StatusPending = "pending"
	StatusActive  = "active"
	StatusClosing = "closing"
	StatusSettled = "settled"

	CreditRatio = 1000 // 1 USDC = 1000 CREDIT
)
