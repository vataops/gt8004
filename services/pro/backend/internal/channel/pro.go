package channel

// ProEngine implements Engine using Hydra state channels as the ledger.
// Agent signs transactions directly; Hydra UTXO is the source of truth.
//
// TODO: Implement in Phase 2
// - Hydra WebSocket client (Init/Close/NewTx)
// - Cardano key manager (Ed25519 keypair generation)
// - CREDIT token minting (Blockfrost + cardano-cli)
// - Unsigned tx construction + signature verification + Hydra submission
// - Hydra Close → Fanout → Escrow settle
type ProEngine struct {
	// hydraClient *hydra.Client
	// cardanoKeys *cardano.KeyManager
	// pool        *pgxpool.Pool
	// logger      *zap.Logger
}
