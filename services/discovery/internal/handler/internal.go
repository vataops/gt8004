package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type syncTokenRequest struct {
	ChainID int   `json:"chain_id" binding:"required"`
	TokenID int64 `json:"token_id" binding:"required"`
}

// InternalSyncToken handles POST /internal/sync-token.
// Triggers an immediate sync of a single ERC-8004 token.
func (h *Handler) InternalSyncToken(c *gin.Context) {
	if h.syncJob == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "sync not available"})
		return
	}

	var req syncTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "chain_id and token_id required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.syncJob.SyncSingleToken(ctx, req.ChainID, req.TokenID); err != nil {
		h.logger.Error("single token sync failed",
			zap.Int("chain_id", req.ChainID),
			zap.Int64("token_id", req.TokenID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sync failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "synced", "chain_id": req.ChainID, "token_id": req.TokenID})
}
