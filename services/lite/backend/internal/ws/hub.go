package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	maxMsgSize = 512
)

// Event is a message broadcast to WebSocket clients.
type Event struct {
	Type      string      `json:"type"`
	ChannelID string      `json:"channel_id,omitempty"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

// Hub manages WebSocket connections and broadcasts events.
type Hub struct {
	// Channel-scoped subscribers: channelID → set of connections
	channelSubs map[string]map[*conn]struct{}
	// Global subscribers (admin events)
	globalSubs map[*conn]struct{}

	mu     sync.RWMutex
	logger *zap.Logger
}

type conn struct {
	ws     *websocket.Conn
	send   chan []byte
	hub    *Hub
	chID   string // empty = global subscriber
	closed bool
	mu     sync.Mutex
}

func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		channelSubs: make(map[string]map[*conn]struct{}),
		globalSubs:  make(map[*conn]struct{}),
		logger:      logger,
	}
}

// Subscribe adds a WebSocket connection for a specific channel.
func (h *Hub) Subscribe(channelID string, ws *websocket.Conn) {
	c := &conn{ws: ws, send: make(chan []byte, 64), hub: h, chID: channelID}

	h.mu.Lock()
	if _, ok := h.channelSubs[channelID]; !ok {
		h.channelSubs[channelID] = make(map[*conn]struct{})
	}
	h.channelSubs[channelID][c] = struct{}{}
	h.mu.Unlock()

	go c.writePump()
	c.readPump()
}

// SubscribeGlobal adds a WebSocket connection for all events (admin).
func (h *Hub) SubscribeGlobal(ws *websocket.Conn) {
	c := &conn{ws: ws, send: make(chan []byte, 64), hub: h}

	h.mu.Lock()
	h.globalSubs[c] = struct{}{}
	h.mu.Unlock()

	go c.writePump()
	c.readPump()
}

// Broadcast sends an event to all subscribers of a channel + global subscribers.
func (h *Hub) Broadcast(evt Event) {
	evt.Timestamp = time.Now().UnixMilli()
	data, err := json.Marshal(evt)
	if err != nil {
		h.logger.Error("ws: failed to marshal event", zap.Error(err))
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	// Channel-specific subscribers
	if evt.ChannelID != "" {
		if subs, ok := h.channelSubs[evt.ChannelID]; ok {
			for c := range subs {
				select {
				case c.send <- data:
				default:
					go h.removeConn(c)
				}
			}
		}
	}

	// Global subscribers always get everything
	for c := range h.globalSubs {
		select {
		case c.send <- data:
		default:
			go h.removeConn(c)
		}
	}
}

func (h *Hub) removeConn(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if c.chID != "" {
		if subs, ok := h.channelSubs[c.chID]; ok {
			delete(subs, c)
			if len(subs) == 0 {
				delete(h.channelSubs, c.chID)
			}
		}
	} else {
		delete(h.globalSubs, c)
	}

	c.mu.Lock()
	if !c.closed {
		c.closed = true
		close(c.send)
	}
	c.mu.Unlock()
}

func (c *conn) readPump() {
	defer func() {
		c.hub.removeConn(c)
		c.ws.Close()
	}()

	c.ws.SetReadLimit(maxMsgSize)
	c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error {
		c.ws.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.ws.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *conn) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.ws.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.ws.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.ws.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.ws.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
