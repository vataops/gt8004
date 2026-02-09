package evm

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"
)

const escrowABIJSON = `[
	{
		"inputs": [{"name":"channelId","type":"bytes32"},{"name":"usdcAmount","type":"uint256"}],
		"name": "deposit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{"name":"channelId","type":"bytes32"},{"name":"usdcAmount","type":"uint256"}],
		"name": "topup",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"name":"channelId","type":"bytes32"},
			{"name":"agents","type":"address[]"},
			{"name":"creditBalances","type":"uint256[]"},
			{"name":"proof","type":"bytes"}
		],
		"name": "settle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"name":"channelId","type":"bytes32"},
			{"name":"agent","type":"address"},
			{"name":"creditBalance","type":"uint256"},
			{"name":"proof","type":"bytes"}
		],
		"name": "exitParticipant",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{"name":"channelId","type":"bytes32"}],
		"name": "emergencyWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`

// EscrowClient wraps interactions with the AELEscrow contract on Base.
type EscrowClient struct {
	client          *ethclient.Client
	contractAddr    common.Address
	contractABI     abi.ABI
	operatorKey     *ecdsa.PrivateKey
	operatorAddress common.Address
	chainID         *big.Int
	logger          *zap.Logger
}

// NewEscrowClient creates a new Escrow contract client.
// Returns nil if rpcURL or contractAddress is empty (dev mode).
func NewEscrowClient(rpcURL, contractAddress, operatorKeyHex string, logger *zap.Logger) (*EscrowClient, error) {
	if rpcURL == "" || contractAddress == "" {
		logger.Info("escrow: disabled (no RPC URL or contract address)")
		return nil, nil
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("connect to EVM RPC: %w", err)
	}

	parsed, err := abi.JSON(strings.NewReader(escrowABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse ABI: %w", err)
	}

	ec := &EscrowClient{
		client:       client,
		contractAddr: common.HexToAddress(contractAddress),
		contractABI:  parsed,
		logger:       logger,
	}

	if operatorKeyHex != "" {
		key, err := crypto.HexToECDSA(stripHexPrefix(operatorKeyHex))
		if err != nil {
			return nil, fmt.Errorf("parse operator key: %w", err)
		}
		ec.operatorKey = key
		ec.operatorAddress = crypto.PubkeyToAddress(key.PublicKey)

		chainID, err := client.ChainID(context.Background())
		if err != nil {
			return nil, fmt.Errorf("get chain ID: %w", err)
		}
		ec.chainID = chainID

		logger.Info("escrow: initialized",
			zap.String("contract", contractAddress),
			zap.String("operator", ec.operatorAddress.Hex()),
			zap.String("chain_id", chainID.String()),
		)
	}

	return ec, nil
}

// Deposit calls escrow.deposit(channelId, usdcAmount).
func (e *EscrowClient) Deposit(ctx context.Context, channelID string, usdcAmount *big.Int) (string, error) {
	if e == nil {
		return "", nil // dev mode
	}

	chID := channelIDToBytes32(channelID)
	data, err := e.contractABI.Pack("deposit", chID, usdcAmount)
	if err != nil {
		return "", fmt.Errorf("pack deposit: %w", err)
	}

	return e.sendTx(ctx, data)
}

// Topup calls escrow.topup(channelId, usdcAmount).
func (e *EscrowClient) Topup(ctx context.Context, channelID string, usdcAmount *big.Int) (string, error) {
	if e == nil {
		return "", nil
	}

	chID := channelIDToBytes32(channelID)
	data, err := e.contractABI.Pack("topup", chID, usdcAmount)
	if err != nil {
		return "", fmt.Errorf("pack topup: %w", err)
	}

	return e.sendTx(ctx, data)
}

// Settle calls escrow.settle(channelId, agents, creditBalances, proof).
func (e *EscrowClient) Settle(ctx context.Context, channelID string, agents []common.Address, creditBalances []*big.Int) (string, error) {
	if e == nil {
		return "", nil
	}

	chID := channelIDToBytes32(channelID)
	proof := []byte{}
	data, err := e.contractABI.Pack("settle", chID, agents, creditBalances, proof)
	if err != nil {
		return "", fmt.Errorf("pack settle: %w", err)
	}

	return e.sendTx(ctx, data)
}

func (e *EscrowClient) sendTx(ctx context.Context, data []byte) (string, error) {
	if e.operatorKey == nil {
		return "", fmt.Errorf("operator key not configured")
	}

	nonce, err := e.client.PendingNonceAt(ctx, e.operatorAddress)
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}

	gasPrice, err := e.client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("suggest gas price: %w", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(e.operatorKey, e.chainID)
	if err != nil {
		return "", fmt.Errorf("create transactor: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))
	auth.GasPrice = gasPrice
	auth.GasLimit = 300000

	tx := bind.NewBoundContract(e.contractAddr, e.contractABI, e.client, e.client, e.client)
	result, err := tx.RawTransact(auth, data)
	if err != nil {
		return "", fmt.Errorf("send tx: %w", err)
	}

	e.logger.Info("escrow tx sent", zap.String("tx_hash", result.Hash().Hex()))
	return result.Hash().Hex(), nil
}

func channelIDToBytes32(channelID string) [32]byte {
	var b [32]byte
	copy(b[:], []byte(channelID))
	return b
}

func stripHexPrefix(s string) string {
	if len(s) >= 2 && s[:2] == "0x" {
		return s[2:]
	}
	return s
}
