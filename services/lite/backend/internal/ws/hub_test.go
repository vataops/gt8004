package ws_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/AEL/aes-lite/internal/ws"
)

func TestHub_BroadcastToChannel(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	hub := ws.NewHub(logger)

	// Set up WS server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("upgrade: %v", err)
		}
		hub.Subscribe("ch_test", conn)
	}))
	defer server.Close()

	// Connect WS client
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Give time for connection setup
	time.Sleep(50 * time.Millisecond)

	// Broadcast event
	hub.Broadcast(ws.Event{
		Type:      "tx_confirmed",
		ChannelID: "ch_test",
		Payload: map[string]interface{}{
			"tx_id":  "tx_123",
			"amount": 1000,
		},
	})

	// Read message from client
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	var evt ws.Event
	if err := json.Unmarshal(msg, &evt); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if evt.Type != "tx_confirmed" {
		t.Errorf("expected tx_confirmed, got %s", evt.Type)
	}
	if evt.ChannelID != "ch_test" {
		t.Errorf("expected ch_test, got %s", evt.ChannelID)
	}
	if evt.Timestamp == 0 {
		t.Error("expected non-zero timestamp")
	}
}

func TestHub_GlobalBroadcast(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	hub := ws.NewHub(logger)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("upgrade: %v", err)
		}
		hub.SubscribeGlobal(conn)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	time.Sleep(50 * time.Millisecond)

	// Broadcast to a specific channel — global subscriber should still receive it
	hub.Broadcast(ws.Event{
		Type:      "channel_created",
		ChannelID: "ch_any",
		Payload:   map[string]interface{}{"test": true},
	})

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	var evt ws.Event
	json.Unmarshal(msg, &evt)

	if evt.Type != "channel_created" {
		t.Errorf("expected channel_created, got %s", evt.Type)
	}
}
