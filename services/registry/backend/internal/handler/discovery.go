package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

var discoveryHTTPClient = &http.Client{Timeout: 10 * time.Second}

// triggerDiscoverySync fires a non-blocking request to the Discovery service
// to sync a specific token after a short delay. The delay gives on-chain state
// time to propagate across RPC nodes before the Discovery service reads it.
// Errors are logged but never propagated — registration must succeed even if
// this notification fails.
func (h *Handler) triggerDiscoverySync(chainID int, tokenID int64) {
	if h.discoveryURL == "" {
		return
	}

	go func() {
		// Wait for on-chain state to propagate across RPC nodes.
		time.Sleep(2 * time.Minute)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		body, _ := json.Marshal(map[string]interface{}{
			"chain_id": chainID,
			"token_id": tokenID,
		})

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.discoveryURL+"/internal/sync-token", bytes.NewReader(body))
		if err != nil {
			h.logger.Warn("discovery sync trigger: failed to create request", zap.Error(err))
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Internal-Secret", h.internalSecret)

		resp, err := discoveryHTTPClient.Do(req)
		if err != nil {
			h.logger.Warn("discovery sync trigger: request failed",
				zap.Int("chain_id", chainID),
				zap.Int64("token_id", tokenID),
				zap.Error(err),
			)
			return
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			h.logger.Warn("discovery sync trigger: non-200 response",
				zap.Int("chain_id", chainID),
				zap.Int64("token_id", tokenID),
				zap.Int("status", resp.StatusCode),
			)
			return
		}

		h.logger.Info("discovery sync triggered",
			zap.Int("chain_id", chainID),
			zap.Int64("token_id", tokenID),
		)
	}()
}

// NotifyMint is a public endpoint that triggers discovery sync after an
// on-chain mint. The frontend calls this right after a successful mint so
// the token appears in the explorer without waiting for the next poll cycle.
func (h *Handler) NotifyMint(c *gin.Context) {
	var req struct {
		ChainID int   `json:"chain_id" binding:"required"`
		TokenID int64 `json:"token_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "chain_id and token_id are required"})
		return
	}

	h.triggerDiscoverySync(req.ChainID, req.TokenID)
	c.JSON(http.StatusOK, gin.H{"status": "sync scheduled"})
}
