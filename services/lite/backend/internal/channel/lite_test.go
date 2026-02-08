package channel_test

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/channel"
)

// requireDB skips the test if DATABASE_URL is not set.
func requireDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connect to DB: %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	return pool
}

func TestLiteEngine_FullLifecycle(t *testing.T) {
	pool := requireDB(t)
	logger, _ := zap.NewDevelopment()
	engine := channel.NewLiteEngine(pool, logger)
	ctx := context.Background()

	// 1. Create channel with 2 agents, 10 USDC
	ch, err := engine.CreateChannel(ctx, channel.CreateChannelRequest{
		Mode:         channel.ModeLite,
		Type:         "private",
		Participants: []string{"agent-alice", "agent-bob"},
		USDCAmount:   10.0,
	})
	if err != nil {
		t.Fatalf("CreateChannel: %v", err)
	}

	if ch.Status != channel.StatusActive {
		t.Errorf("expected status %s, got %s", channel.StatusActive, ch.Status)
	}
	if ch.TotalCreditsMinted != 10_000 {
		t.Errorf("expected 10000 credits, got %d", ch.TotalCreditsMinted)
	}
	t.Logf("channel created: %s", ch.ChannelID)

	// 2. Check initial balances (5000 each)
	balances, err := engine.GetBalances(ctx, ch.ChannelID)
	if err != nil {
		t.Fatalf("GetBalances: %v", err)
	}
	if len(balances) != 2 {
		t.Fatalf("expected 2 balances, got %d", len(balances))
	}
	balMap := make(map[string]int64)
	for _, b := range balances {
		balMap[b.AgentID] = b.Balance
	}
	if balMap["agent-alice"] != 5000 || balMap["agent-bob"] != 5000 {
		t.Errorf("unexpected balances: %v", balMap)
	}

	// 3. Send transaction: alice → bob, 1000 credits
	txResult, err := engine.SendTransaction(ctx, ch.ChannelID, channel.TxRequest{
		From:   "agent-alice",
		To:     "agent-bob",
		Amount: 1000,
		Memo:   "test payment",
	})
	if err != nil {
		t.Fatalf("SendTransaction: %v", err)
	}
	if txResult.Status != "confirmed" {
		t.Errorf("expected confirmed, got %s", txResult.Status)
	}
	t.Logf("tx confirmed: %s (%.3fms)", txResult.TxID, txResult.LatencyMs)

	// 4. Verify updated balances
	balances, _ = engine.GetBalances(ctx, ch.ChannelID)
	balMap = make(map[string]int64)
	for _, b := range balances {
		balMap[b.AgentID] = b.Balance
	}
	if balMap["agent-alice"] != 4000 {
		t.Errorf("alice should have 4000, got %d", balMap["agent-alice"])
	}
	if balMap["agent-bob"] != 6000 {
		t.Errorf("bob should have 6000, got %d", balMap["agent-bob"])
	}

	// 5. Test overdraft protection
	_, err = engine.SendTransaction(ctx, ch.ChannelID, channel.TxRequest{
		From:   "agent-alice",
		To:     "agent-bob",
		Amount: 999999,
		Memo:   "should fail",
	})
	if err == nil {
		t.Error("expected overdraft error, got nil")
	}

	// 6. Topup credits
	err = engine.TopupCredits(ctx, ch.ChannelID, "agent-alice", 2000)
	if err != nil {
		t.Fatalf("TopupCredits: %v", err)
	}
	balances, _ = engine.GetBalances(ctx, ch.ChannelID)
	balMap = make(map[string]int64)
	for _, b := range balances {
		balMap[b.AgentID] = b.Balance
	}
	if balMap["agent-alice"] != 6000 {
		t.Errorf("alice should have 6000 after topup, got %d", balMap["agent-alice"])
	}

	// 7. Close channel + verify settlement
	settlement, err := engine.CloseChannel(ctx, ch.ChannelID)
	if err != nil {
		t.Fatalf("CloseChannel: %v", err)
	}
	if settlement.TotalTx != 1 {
		t.Errorf("expected 1 total tx, got %d", settlement.TotalTx)
	}

	// alice: 6000 credits, bob: 6000 credits — total 12000 credits, 12 USDC total
	totalCredits := settlement.Balances["agent-alice"] + settlement.Balances["agent-bob"]
	if totalCredits != 12000 {
		t.Errorf("expected total 12000 credits, got %d", totalCredits)
	}

	// Each should get proportional USDC
	for agent, usdc := range settlement.USDCOwed {
		t.Logf("settlement: %s → $%.2f (credits: %d)", agent, usdc, settlement.Balances[agent])
	}

	// 8. Verify channel is settled (can't send more tx)
	_, err = engine.SendTransaction(ctx, ch.ChannelID, channel.TxRequest{
		From:   "agent-alice",
		To:     "agent-bob",
		Amount: 100,
	})
	if err == nil {
		t.Error("expected error sending tx on settled channel")
	}

	// 9. Verify GetChannel shows settled status
	chFinal, err := engine.GetChannel(ctx, ch.ChannelID)
	if err != nil {
		t.Fatalf("GetChannel: %v", err)
	}
	if chFinal.Status != channel.StatusSettled {
		t.Errorf("expected settled, got %s", chFinal.Status)
	}

	t.Log("full lifecycle test passed")
}

func TestLiteEngine_MultipleTransactions(t *testing.T) {
	pool := requireDB(t)
	logger, _ := zap.NewDevelopment()
	engine := channel.NewLiteEngine(pool, logger)
	ctx := context.Background()

	ch, err := engine.CreateChannel(ctx, channel.CreateChannelRequest{
		Mode:         channel.ModeLite,
		Participants: []string{"sender", "receiver"},
		USDCAmount:   100.0,
	})
	if err != nil {
		t.Fatalf("CreateChannel: %v", err)
	}

	// Send 50 transactions
	for i := 0; i < 50; i++ {
		_, err := engine.SendTransaction(ctx, ch.ChannelID, channel.TxRequest{
			From:   "sender",
			To:     "receiver",
			Amount: 1000,
			Memo:   fmt.Sprintf("tx #%d", i),
		})
		if err != nil {
			t.Fatalf("tx #%d failed: %v", i, err)
		}
	}

	// Verify balances: sender started with 50000, sent 50*1000 = 50000 → 0 left
	balances, _ := engine.GetBalances(ctx, ch.ChannelID)
	balMap := make(map[string]int64)
	for _, b := range balances {
		balMap[b.AgentID] = b.Balance
	}
	if balMap["sender"] != 0 {
		t.Errorf("sender should have 0, got %d", balMap["sender"])
	}
	if balMap["receiver"] != 100_000 {
		t.Errorf("receiver should have 100000, got %d", balMap["receiver"])
	}

	// Verify channel stats
	chInfo, _ := engine.GetChannel(ctx, ch.ChannelID)
	if chInfo.TotalTransactions != 50 {
		t.Errorf("expected 50 tx, got %d", chInfo.TotalTransactions)
	}
	t.Logf("50 transactions completed, avg latency: %.3fms", chInfo.AvgLatencyMs)
}
