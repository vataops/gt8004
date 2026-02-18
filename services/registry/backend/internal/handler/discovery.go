package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"go.uber.org/zap"
)

var discoveryHTTPClient = &http.Client{Timeout: 10 * time.Second}

// triggerDiscoverySync fires a non-blocking request to the Discovery service
// to immediately sync a specific token. Errors are logged but never propagated
// — registration must succeed even if this notification fails.
func (h *Handler) triggerDiscoverySync(chainID int, tokenID int64) {
	if h.discoveryURL == "" {
		return
	}

	go func() {
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
