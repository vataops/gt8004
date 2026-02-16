package ingest

import (
	"context"
	"math"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-ingest/internal/store"
)

// USDC contract addresses per chain.
var usdcContracts = map[int]common.Address{
	1:        common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), // Ethereum Mainnet
	84532:    common.HexToAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"), // Base Sepolia
	11155111: common.HexToAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"), // Ethereum Sepolia
}

// RPC endpoints per chain.
var chainRPCs = map[int]string{
	1:        "https://ethereum-rpc.publicnode.com",
	84532:    "https://base-sepolia-rpc.publicnode.com",
	11155111: "https://ethereum-sepolia-rpc.publicnode.com",
}

// ERC-20 Transfer event topic: Transfer(address,address,uint256)
var topicTransfer = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

// Verifier performs on-chain verification of x402 payment transactions.
type Verifier struct {
	clients map[int]*ethclient.Client
	store   *store.Store
	logger  *zap.Logger
}

// NewVerifier creates a Verifier with ethclients for all supported chains.
func NewVerifier(s *store.Store, logger *zap.Logger) *Verifier {
	v := &Verifier{
		clients: make(map[int]*ethclient.Client),
		store:   s,
		logger:  logger,
	}

	for chainID, rpc := range chainRPCs {
		client, err := ethclient.Dial(rpc)
		if err != nil {
			logger.Error("failed to connect to chain RPC",
				zap.Int("chain_id", chainID), zap.String("rpc", rpc), zap.Error(err))
			continue
		}
		v.clients[chainID] = client
		logger.Info("verifier connected to chain RPC",
			zap.Int("chain_id", chainID), zap.String("rpc", rpc))
	}

	return v
}

// VerifyPayment checks a tx_hash on-chain and updates the revenue entry.
// This is called asynchronously from the enricher.
func (v *Verifier) VerifyPayment(ctx context.Context, entryID int64, txHash string, expectedAmount float64, expectedPayer string, chainID int) {
	client, ok := v.clients[chainID]
	if !ok {
		v.logger.Warn("no RPC client for chain, skipping verification",
			zap.Int("chain_id", chainID), zap.Int64("entry_id", entryID))
		return
	}

	usdcAddr, ok := usdcContracts[chainID]
	if !ok {
		v.logger.Warn("no USDC contract for chain, skipping verification",
			zap.Int("chain_id", chainID), zap.Int64("entry_id", entryID))
		return
	}

	verifyCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	hash := common.HexToHash(txHash)
	receipt, err := client.TransactionReceipt(verifyCtx, hash)
	if err != nil {
		v.logger.Warn("failed to get tx receipt",
			zap.String("tx_hash", txHash), zap.Int("chain_id", chainID), zap.Error(err))
		return
	}

	// Check transaction succeeded
	if receipt.Status != 1 {
		v.logger.Warn("tx failed on-chain",
			zap.String("tx_hash", txHash), zap.Uint64("status", receipt.Status))
		return
	}

	// Look for USDC Transfer event in receipt logs
	verified := false
	for _, log := range receipt.Logs {
		if len(log.Topics) < 3 {
			continue
		}
		// Must be Transfer event from USDC contract
		if log.Topics[0] != topicTransfer {
			continue
		}
		if log.Address != usdcAddr {
			continue
		}

		// Decode from address (topic[1])
		from := common.BytesToAddress(log.Topics[1].Bytes())

		// Decode amount from data (uint256, USDC has 6 decimals)
		if len(log.Data) < 32 {
			continue
		}
		amountBig := new(big.Int).SetBytes(log.Data[:32])
		amountFloat := float64(amountBig.Int64()) / 1e6

		// Verify payer matches (case-insensitive)
		payerMatch := expectedPayer == "" || strings.EqualFold(from.Hex(), expectedPayer)

		// Verify amount matches (allow small floating-point tolerance)
		amountMatch := math.Abs(amountFloat-expectedAmount) < 0.001

		if payerMatch && amountMatch {
			verified = true
			break
		}
	}

	if !verified {
		v.logger.Warn("tx verification failed: no matching USDC transfer found",
			zap.String("tx_hash", txHash),
			zap.Float64("expected_amount", expectedAmount),
			zap.String("expected_payer", expectedPayer))
		return
	}

	// Update DB
	if err := v.store.UpdateRevenueVerified(ctx, entryID, true, chainID, time.Now()); err != nil {
		v.logger.Error("failed to update revenue verification",
			zap.Int64("entry_id", entryID), zap.Error(err))
		return
	}

	v.logger.Info("x402 payment verified on-chain",
		zap.Int64("entry_id", entryID),
		zap.String("tx_hash", txHash),
		zap.Int("chain_id", chainID),
		zap.Float64("amount", expectedAmount))
}
