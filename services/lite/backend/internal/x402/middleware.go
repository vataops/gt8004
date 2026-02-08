package x402

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PaymentInfo holds verified payment details from x402.
type PaymentInfo struct {
	TxHash    string  `json:"tx_hash"`
	Amount    float64 `json:"amount"`
	Token     string  `json:"token"`
	Network   string  `json:"network"`
	Recipient string  `json:"recipient"`
	Payer     string  `json:"payer"`
}

// VerifyRequest is sent to the x402 facilitator.
type VerifyRequest struct {
	PaymentProof string `json:"payment_proof"`
	Recipient    string `json:"recipient"`
	MinAmount    string `json:"min_amount,omitempty"`
}

// VerifyResponse from the x402 facilitator.
type VerifyResponse struct {
	Valid     bool    `json:"valid"`
	TxHash    string  `json:"tx_hash"`
	Amount    float64 `json:"amount"`
	Token     string  `json:"token"`
	Network   string  `json:"network"`
	Recipient string  `json:"recipient"`
	Payer     string  `json:"payer"`
	Error     string  `json:"error,omitempty"`
}

// Middleware creates a Gin middleware that verifies x402 payment proofs.
// If facilitatorURL is empty, verification is skipped (dev mode).
func Middleware(facilitatorURL, recipient string, logger *zap.Logger) gin.HandlerFunc {
	client := &http.Client{Timeout: 10 * time.Second}

	return func(c *gin.Context) {
		// Dev mode: skip if facilitator not configured
		if facilitatorURL == "" {
			logger.Debug("x402: skipping verification (no facilitator configured)")
			c.Next()
			return
		}

		proof := c.GetHeader("X-Payment")
		if proof == "" {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error": "payment required",
				"x402": gin.H{
					"network":   "base-sepolia",
					"token":     "USDC",
					"recipient": recipient,
				},
			})
			return
		}

		info, err := verifyPayment(client, facilitatorURL, proof, recipient)
		if err != nil {
			logger.Error("x402: verification failed", zap.Error(err))
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error": fmt.Sprintf("payment verification failed: %v", err),
			})
			return
		}

		// Set payment info in context for handlers
		c.Set("x402_payment", info)
		c.Next()
	}
}

// GetPayment extracts verified payment info from gin context.
func GetPayment(c *gin.Context) *PaymentInfo {
	v, exists := c.Get("x402_payment")
	if !exists {
		return nil
	}
	info, ok := v.(*PaymentInfo)
	if !ok {
		return nil
	}
	return info
}

func verifyPayment(client *http.Client, facilitatorURL, proof, expectedRecipient string) (*PaymentInfo, error) {
	reqBody, err := json.Marshal(VerifyRequest{
		PaymentProof: proof,
		Recipient:    expectedRecipient,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := client.Post(facilitatorURL+"/verify", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("call facilitator: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result VerifyResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if !result.Valid {
		return nil, fmt.Errorf("invalid payment: %s", result.Error)
	}

	return &PaymentInfo{
		TxHash:    result.TxHash,
		Amount:    result.Amount,
		Token:     result.Token,
		Network:   result.Network,
		Recipient: result.Recipient,
		Payer:     result.Payer,
	}, nil
}
