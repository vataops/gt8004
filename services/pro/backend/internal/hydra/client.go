package hydra

// Client manages WebSocket connection to a Hydra node.
//
// TODO: Implement in Phase 2
// - Persistent WebSocket connection per channel
// - Init, Close, NewTx commands
// - Event parsing (HeadIsOpen, HeadIsClosed, TxValid, etc.)
// - Snapshot/Fanout handling
type Client struct {
	// nodeURL string
	// conn    *websocket.Conn
}
