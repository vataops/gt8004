package settlement

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"

	"github.com/AEL/ael-lite/internal/channel"
	"github.com/AEL/ael-lite/internal/evm"
	"github.com/AEL/ael-lite/internal/store"
)

// Settler handles the settlement flow: DB balances → Escrow settle on-chain.
type Settler struct {
	store  *store.Store
	escrow *evm.EscrowClient
	logger *zap.Logger
}

func New(s *store.Store, escrow *evm.EscrowClient, logger *zap.Logger) *Settler {
	return &Settler{store: s, escrow: escrow, logger: logger}
}

// Settle takes a Settlement from the channel engine and calls Escrow.settle on-chain.
// It maps agent_id → EVM address from the DB to build the contract call.
func (s *Settler) Settle(ctx context.Context, settlement *channel.Settlement) (string, error) {
	if s.escrow == nil {
		s.logger.Info("settlement: escrow not configured, skipping on-chain settle")
		return "", nil
	}

	// Look up EVM addresses for each agent
	var agents []common.Address
	var creditBalances []*big.Int

	for agentID, balance := range settlement.Balances {
		agent, err := s.store.GetAgent(ctx, agentID)
		if err != nil {
			s.logger.Warn("settlement: agent not found, skipping",
				zap.String("agent_id", agentID), zap.Error(err))
			continue
		}

		if agent.EVMAddress == nil || *agent.EVMAddress == "" {
			s.logger.Warn("settlement: agent has no EVM address, skipping",
				zap.String("agent_id", agentID))
			continue
		}

		agents = append(agents, common.HexToAddress(*agent.EVMAddress))
		creditBalances = append(creditBalances, big.NewInt(balance))
	}

	if len(agents) == 0 {
		return "", fmt.Errorf("no agents with EVM addresses found for settlement")
	}

	txHash, err := s.escrow.Settle(ctx, settlement.ChannelID, agents, creditBalances)
	if err != nil {
		return "", fmt.Errorf("escrow settle: %w", err)
	}

	s.logger.Info("settlement: escrow settle tx sent",
		zap.String("channel", settlement.ChannelID),
		zap.String("tx_hash", txHash),
		zap.Int("agents", len(agents)),
	)

	return txHash, nil
}
