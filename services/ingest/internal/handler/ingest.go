package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-ingest/internal/ingest"
	"github.com/GT8004/gt8004-ingest/internal/middleware"
)

// IngestLogs handles POST /v1/ingest - SDK batch log ingestion.
func (h *Handler) IngestLogs(c *gin.Context) {
	agentDBID, exists := c.Get(middleware.ContextKeyAgentDBID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	dbID := agentDBID.(uuid.UUID)

	agentID, _ := c.Get(middleware.ContextKeyAgentID)
	agentIDStr, _ := agentID.(string)
	chainIDVal, _ := c.Get(middleware.ContextKeyChainID)
	chainID, _ := chainIDVal.(int)

	const maxBodySize = 51200 // 50KB
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBodySize+1))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}
	if len(body) > maxBodySize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
		return
	}

	batch, err := ingest.ParseBatch(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch format"})
		return
	}

	h.worker.Submit(&ingest.IngestJob{
		AgentDBID: dbID,
		AgentID:   agentIDStr,
		ChainID:   chainID,
		Batch:     batch,
	})

	h.logger.Debug("ingest batch submitted",
		zap.String("agent_id", agentIDStr),
		zap.String("batch_id", batch.BatchID),
		zap.Int("entries", len(batch.Entries)))

	c.JSON(http.StatusAccepted, gin.H{
		"status":  "accepted",
		"entries": len(batch.Entries),
	})
}
