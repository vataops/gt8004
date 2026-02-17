package identity

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
)

// AgentInfo holds verified agent identity information.
type AgentInfo struct {
	AgentID         string  `json:"agent_id"`
	EVMAddress      string  `json:"evm_address"`
	ReputationScore float64 `json:"reputation_score,omitempty"`
	Verified        bool    `json:"verified"`
}

// ChallengeRequest is the request to create a challenge.
type ChallengeRequest struct {
	AgentID string `json:"agent_id" binding:"required"`
}

// ChallengeResponse contains the challenge for the agent to sign.
type ChallengeResponse struct {
	Challenge string `json:"challenge"`
	ExpiresAt int64  `json:"expires_at"`
}

// VerifyRequest is the request to verify a signed challenge.
type VerifyRequest struct {
	Challenge string `json:"challenge" binding:"required"`
	Signature string `json:"signature" binding:"required"`
	AgentID   string `json:"agent_id" binding:"required"`
}

// ChallengeStore abstracts challenge persistence so it can be backed by
// a database (PostgreSQL) instead of an in-memory map.  This is critical
// for multi-instance deployments (e.g. Cloud Run) where a challenge created
// on one instance must be verifiable on another.
type ChallengeStore interface {
	SaveChallenge(ctx context.Context, challengeHex, agentID string, expiresAt time.Time) error
	// ConsumeChallenge atomically retrieves and deletes the challenge.
	// Returns agentID, expiresAt. If not found, returns an error.
	ConsumeChallenge(ctx context.Context, challengeHex string) (agentID string, expiresAt time.Time, err error)
}

type challenge struct {
	agentID   string
	expiresAt time.Time
}

// memoryStore is the default in-memory fallback (single-instance only).
type memoryStore struct {
	challenges map[string]challenge
	mu         sync.Mutex
}

func (m *memoryStore) SaveChallenge(_ context.Context, challengeHex, agentID string, expiresAt time.Time) error {
	m.mu.Lock()
	m.challenges[challengeHex] = challenge{agentID: agentID, expiresAt: expiresAt}
	m.mu.Unlock()
	return nil
}

func (m *memoryStore) ConsumeChallenge(_ context.Context, challengeHex string) (string, time.Time, error) {
	m.mu.Lock()
	ch, exists := m.challenges[challengeHex]
	if exists {
		delete(m.challenges, challengeHex)
	}
	m.mu.Unlock()
	if !exists {
		return "", time.Time{}, fmt.Errorf("challenge not found or already used")
	}
	return ch.agentID, ch.expiresAt, nil
}

func (m *memoryStore) cleanup() {
	m.mu.Lock()
	now := time.Now()
	for k, ch := range m.challenges {
		if now.After(ch.expiresAt) {
			delete(m.challenges, k)
		}
	}
	m.mu.Unlock()
}

// Verifier handles ERC-8004 identity verification.
type Verifier struct {
	store  ChallengeStore
	logger *zap.Logger

	registryAddress string
	registryRPC     string
}

func NewVerifier(registryAddress, registryRPC string, logger *zap.Logger) *Verifier {
	ms := &memoryStore{challenges: make(map[string]challenge)}
	v := &Verifier{
		store:           ms,
		logger:          logger,
		registryAddress: registryAddress,
		registryRPC:     registryRPC,
	}
	go v.cleanupLoop(ms)
	return v
}

// NewVerifierWithStore creates a Verifier backed by an external ChallengeStore
// (e.g. PostgreSQL). No cleanup goroutine is started because the store is
// expected to handle expiry (e.g. via SQL DELETE).
func NewVerifierWithStore(registryAddress, registryRPC string, cs ChallengeStore, logger *zap.Logger) *Verifier {
	return &Verifier{
		store:           cs,
		logger:          logger,
		registryAddress: registryAddress,
		registryRPC:     registryRPC,
	}
}

// CreateChallenge generates a random 32-byte challenge for an agent.
func (v *Verifier) CreateChallenge(agentID string) (*ChallengeResponse, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("generate random: %w", err)
	}

	ch := hex.EncodeToString(b)
	expiresAt := time.Now().Add(30 * time.Second)

	if err := v.store.SaveChallenge(context.Background(), ch, agentID, expiresAt); err != nil {
		return nil, fmt.Errorf("save challenge: %w", err)
	}

	return &ChallengeResponse{
		Challenge: ch,
		ExpiresAt: expiresAt.Unix(),
	}, nil
}

// VerifySignature verifies that the agent signed the challenge with their EVM key.
func (v *Verifier) VerifySignature(req VerifyRequest) (*AgentInfo, error) {
	agentID, expiresAt, err := v.store.ConsumeChallenge(context.Background(), req.Challenge)
	if err != nil {
		return nil, err
	}
	if time.Now().After(expiresAt) {
		return nil, fmt.Errorf("challenge expired")
	}
	if agentID != req.AgentID {
		return nil, fmt.Errorf("agent_id mismatch")
	}

	// Decode signature
	sigBytes, err := hex.DecodeString(stripHexPrefix(req.Signature))
	if err != nil {
		return nil, fmt.Errorf("decode signature: %w", err)
	}
	if len(sigBytes) != 65 {
		return nil, fmt.Errorf("invalid signature length: %d", len(sigBytes))
	}

	// Ethereum personal_sign: prefix the message
	challengeBytes, err := hex.DecodeString(req.Challenge)
	if err != nil {
		return nil, fmt.Errorf("decode challenge: %w", err)
	}
	prefixed := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(challengeBytes), challengeBytes)
	hash := crypto.Keccak256Hash([]byte(prefixed))

	// Adjust V value for recovery (27/28 → 0/1)
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// Recover public key from signature
	pubKey, err := crypto.SigToPub(hash.Bytes(), sigBytes)
	if err != nil {
		return nil, fmt.Errorf("recover public key: %w", err)
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	expectedAddr := common.HexToAddress(req.AgentID)

	if recoveredAddr != expectedAddr {
		return nil, fmt.Errorf("signature does not match agent_id: recovered %s, expected %s",
			recoveredAddr.Hex(), expectedAddr.Hex())
	}

	// Query ERC-8004 registry (if configured)
	info := &AgentInfo{
		AgentID:    req.AgentID,
		EVMAddress: recoveredAddr.Hex(),
		Verified:   true,
	}

	if v.registryAddress != "" {
		regInfo, err := v.queryRegistry(recoveredAddr)
		if err != nil {
			v.logger.Warn("registry query failed, proceeding without",
				zap.Error(err), zap.String("agent", req.AgentID))
		} else if regInfo != nil {
			info.ReputationScore = regInfo.ReputationScore
		}
	}

	return info, nil
}

func (v *Verifier) queryRegistry(addr common.Address) (*AgentInfo, error) {
	// TODO: Call ERC-8004 registry contract via ethclient
	// For now, return nil (no registry data)
	// This will be fully implemented when a real registry is deployed
	v.logger.Debug("registry query stub", zap.String("address", addr.Hex()))
	return nil, nil
}

func (v *Verifier) cleanupLoop(ms *memoryStore) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		ms.cleanup()
	}
}

func stripHexPrefix(s string) string {
	if len(s) >= 2 && s[:2] == "0x" {
		return s[2:]
	}
	return s
}
