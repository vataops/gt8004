package store

import (
	"context"
)

type Overview struct {
	ActiveChannels     int     `json:"active_channels"`
	TotalChannels      int     `json:"total_channels"`
	TotalAgents        int     `json:"total_agents"`
	TotalTransactions  int64   `json:"total_transactions"`
	TotalUSDCDeposited float64 `json:"total_usdc_deposited"`
	TotalCreditsMinted int64   `json:"total_credits_minted"`
}

type EscrowOverview struct {
	TotalUSDCDeposited    float64 `json:"total_usdc_deposited"`
	TotalCreditsInCircuit int64   `json:"total_credits_in_circulation"`
	ActiveChannels        int     `json:"active_channels"`
	SettledChannels       int     `json:"settled_channels"`
}

func (s *Store) GetOverview(ctx context.Context) (*Overview, error) {
	o := &Overview{}

	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0),
			COUNT(*),
			COALESCE(SUM(total_usdc_deposited), 0),
			COALESCE(SUM(total_credits_minted), 0),
			COALESCE(SUM(total_transactions), 0)
		FROM channels
	`).Scan(&o.ActiveChannels, &o.TotalChannels, &o.TotalUSDCDeposited, &o.TotalCreditsMinted, &o.TotalTransactions)
	if err != nil {
		return nil, err
	}

	err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM agents`).Scan(&o.TotalAgents)
	if err != nil {
		return nil, err
	}

	return o, nil
}

func (s *Store) GetEscrowOverview(ctx context.Context) (*EscrowOverview, error) {
	e := &EscrowOverview{}

	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(total_usdc_deposited), 0),
			COALESCE(SUM(total_credits_minted), 0),
			COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END), 0)
		FROM channels
	`).Scan(&e.TotalUSDCDeposited, &e.TotalCreditsInCircuit, &e.ActiveChannels, &e.SettledChannels)
	if err != nil {
		return nil, err
	}

	return e, nil
}
