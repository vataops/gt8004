package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/AEL/ael-lite/internal/channel"
	"github.com/AEL/ael-lite/internal/handler"
	"github.com/AEL/ael-common/ws"
)

// mockEngine is a simple in-memory Engine for testing handlers without DB.
type mockEngine struct {
	channels map[string]*channel.Channel
	balances map[string]map[string]int64 // channelID → agentID → balance
	txCount  int64
}

func newMockEngine() *mockEngine {
	return &mockEngine{
		channels: make(map[string]*channel.Channel),
		balances: make(map[string]map[string]int64),
	}
}

func (m *mockEngine) CreateChannel(_ context.Context, req channel.CreateChannelRequest) (*channel.Channel, error) {
	chID := "ch_test123"
	credits := int64(req.USDCAmount * channel.CreditRatio)
	ch := &channel.Channel{
		ID:                 "uuid-test",
		ChannelID:          chID,
		Mode:               channel.ModeLite,
		Type:               "private",
		Status:             channel.StatusActive,
		TotalUSDCDeposited: req.USDCAmount,
		TotalCreditsMinted: credits,
		MaxParticipants:    10,
	}
	m.channels[chID] = ch

	perAgent := credits / int64(len(req.Participants))
	m.balances[chID] = make(map[string]int64)
	for _, p := range req.Participants {
		m.balances[chID][p] = perAgent
	}

	return ch, nil
}

func (m *mockEngine) GetChannel(_ context.Context, channelID string) (*channel.Channel, error) {
	ch, ok := m.channels[channelID]
	if !ok {
		return nil, context.DeadlineExceeded
	}
	return ch, nil
}

func (m *mockEngine) SendTransaction(_ context.Context, channelID string, req channel.TxRequest) (*channel.TxResult, error) {
	bals := m.balances[channelID]
	if bals[req.From] < req.Amount {
		return nil, context.DeadlineExceeded
	}
	bals[req.From] -= req.Amount
	bals[req.To] += req.Amount
	m.txCount++
	return &channel.TxResult{
		TxID:      "tx_mock",
		ChannelID: channelID,
		From:      req.From,
		To:        req.To,
		Amount:    req.Amount,
		Status:    "confirmed",
		LatencyMs: 0.1,
	}, nil
}

func (m *mockEngine) TopupCredits(_ context.Context, channelID string, agentID string, amount int64) error {
	if _, ok := m.balances[channelID]; !ok {
		return context.DeadlineExceeded
	}
	m.balances[channelID][agentID] += amount
	return nil
}

func (m *mockEngine) CloseChannel(_ context.Context, channelID string) (*channel.Settlement, error) {
	ch, ok := m.channels[channelID]
	if !ok {
		return nil, context.DeadlineExceeded
	}
	ch.Status = channel.StatusSettled

	balances := make(map[string]int64)
	for k, v := range m.balances[channelID] {
		balances[k] = v
	}

	return &channel.Settlement{
		ChannelID: channelID,
		Balances:  balances,
		USDCOwed:  map[string]float64{},
		TotalUSDC: ch.TotalUSDCDeposited,
		TotalTx:   m.txCount,
	}, nil
}

func (m *mockEngine) GetBalances(_ context.Context, channelID string) ([]channel.CreditBalance, error) {
	bals, ok := m.balances[channelID]
	if !ok {
		return nil, context.DeadlineExceeded
	}
	var result []channel.CreditBalance
	for agent, bal := range bals {
		result = append(result, channel.CreditBalance{
			ChannelID: channelID,
			AgentID:   agent,
			Balance:   bal,
		})
	}
	return result, nil
}

func setupRouter(engine channel.Engine) *gin.Engine {
	gin.SetMode(gin.TestMode)
	logger, _ := zap.NewDevelopment()
	hub := ws.NewHub(logger)
	h := handler.New(nil, engine, nil, nil, nil, hub, logger)

	r := gin.New()
	v1 := r.Group("/v1")
	channels := v1.Group("/channels")
	{
		channels.POST("", h.CreateChannel)
		channels.GET("/:id", h.GetChannel)
		channels.POST("/:id/tx", h.CreateTransaction)
		channels.POST("/:id/topup", h.TopupChannel)
		channels.POST("/:id/close", h.CloseChannel)
	}
	return r
}

func TestHandler_CreateChannel(t *testing.T) {
	engine := newMockEngine()
	r := setupRouter(engine)

	body, _ := json.Marshal(map[string]interface{}{
		"participants": []string{"alice", "bob"},
		"usdc_amount":  10.0,
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/channels", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp channel.Channel
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.ChannelID != "ch_test123" {
		t.Errorf("unexpected channel_id: %s", resp.ChannelID)
	}
	if resp.TotalCreditsMinted != 10000 {
		t.Errorf("expected 10000 credits, got %d", resp.TotalCreditsMinted)
	}
}

func TestHandler_TransactionFlow(t *testing.T) {
	engine := newMockEngine()
	r := setupRouter(engine)

	// Create channel
	body, _ := json.Marshal(map[string]interface{}{
		"participants": []string{"alice", "bob"},
		"usdc_amount":  5.0,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/channels", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d", w.Code)
	}

	// Send transaction: alice → bob, 1000 credits
	txBody, _ := json.Marshal(map[string]interface{}{
		"from":   "alice",
		"to":     "bob",
		"amount": 1000,
		"memo":   "test",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/channels/ch_test123/tx", bytes.NewBuffer(txBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("tx: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var txResult channel.TxResult
	json.Unmarshal(w.Body.Bytes(), &txResult)
	if txResult.Status != "confirmed" {
		t.Errorf("expected confirmed, got %s", txResult.Status)
	}

	// Get channel — check balances
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/channels/ch_test123", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}

	var getResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &getResp)
	if getResp["balances"] == nil {
		t.Error("expected balances in response")
	}
}

func TestHandler_CloseChannel(t *testing.T) {
	engine := newMockEngine()
	r := setupRouter(engine)

	// Create channel
	body, _ := json.Marshal(map[string]interface{}{
		"participants": []string{"alice", "bob"},
		"usdc_amount":  5.0,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/channels", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	// Close channel
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/channels/ch_test123/close", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("close: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var closeResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &closeResp)
	if closeResp["settlement"] == nil {
		t.Error("expected settlement in response")
	}
}

func TestHandler_GetChannel_NotFound(t *testing.T) {
	engine := newMockEngine()
	r := setupRouter(engine)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/channels/nonexistent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_CreateChannel_BadRequest(t *testing.T) {
	engine := newMockEngine()
	r := setupRouter(engine)

	// Missing required fields
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/channels", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
