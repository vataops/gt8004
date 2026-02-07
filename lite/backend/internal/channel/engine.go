package channel

import (
	"context"
	"time"
)

// Channel represents a payment channel between agents.
type Channel struct {
	ID                 string     `json:"id"`
	ChannelID          string     `json:"channel_id"`
	Mode               string     `json:"mode"`
	Type               string     `json:"type"`
	Status             string     `json:"status"` // pending → active → closing → settled
	HydraHeadID        *string    `json:"hydra_head_id,omitempty"` // reserved for Pro
	TotalUSDCDeposited float64    `json:"total_usdc_deposited"`
	TotalCreditsMinted int64      `json:"total_credits_minted"`
	TotalTransactions  int64      `json:"total_transactions"`
	AvgLatencyMs       float32    `json:"avg_latency_ms"`
	MaxParticipants    int        `json:"max_participants"`
	CreatedAt          time.Time  `json:"created_at"`
	OpenedAt           *time.Time `json:"opened_at,omitempty"`
	ClosedAt           *time.Time `json:"closed_at,omitempty"`
}

// CreateChannelRequest is the request to create a new channel.
type CreateChannelRequest struct {
	Mode            string   `json:"mode"`
	Type            string   `json:"type"`
	Participants    []string `json:"participants" binding:"required,min=1"`
	USDCAmount      float64  `json:"usdc_amount" binding:"required,gt=0"`
	MaxParticipants int      `json:"max_participants"`
}

// TxRequest is a transaction request within a channel.
type TxRequest struct {
	From   string `json:"from" binding:"required"`
	To     string `json:"to" binding:"required"`
	Amount int64  `json:"amount" binding:"required,gt=0"`
	Memo   string `json:"memo"`
}

// TxResult is the result of a transaction.
type TxResult struct {
	TxID       string  `json:"tx_id"`
	ChannelID  string  `json:"channel_id"`
	From       string  `json:"from"`
	To         string  `json:"to"`
	Amount     int64   `json:"amount"`
	Memo       string  `json:"memo"`
	Status     string  `json:"status"`
	LatencyMs  float64 `json:"latency_ms"`
}

// Settlement contains the final settlement data when a channel closes.
type Settlement struct {
	ChannelID  string            `json:"channel_id"`
	Balances   map[string]int64  `json:"balances"`   // agent_id → final CREDIT balance
	USDCOwed   map[string]float64 `json:"usdc_owed"` // agent_id → USDC to receive
	TotalUSDC  float64           `json:"total_usdc"`
	TotalTx    int64             `json:"total_transactions"`
}

// CreditBalance represents an agent's credit balance in a channel.
type CreditBalance struct {
	ChannelID string `json:"channel_id"`
	AgentID   string `json:"agent_id"`
	Balance   int64  `json:"balance"`
}

// Engine defines the interface for channel operations.
type Engine interface {
	CreateChannel(ctx context.Context, req CreateChannelRequest) (*Channel, error)
	GetChannel(ctx context.Context, channelID string) (*Channel, error)
	SendTransaction(ctx context.Context, channelID string, req TxRequest) (*TxResult, error)
	TopupCredits(ctx context.Context, channelID string, agentID string, amount int64) error
	CloseChannel(ctx context.Context, channelID string) (*Settlement, error)
	GetBalances(ctx context.Context, channelID string) ([]CreditBalance, error)
}

const (
	ModeLite = "lite"

	StatusPending = "pending"
	StatusActive  = "active"
	StatusClosing = "closing"
	StatusSettled = "settled"

	CreditRatio = 1000 // 1 USDC = 1000 CREDIT
)
