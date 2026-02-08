package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/ingest"
)

// IngestLogs handles POST /v1/ingest.
func (h *Handler) IngestLogs(c *gin.Context) {
	agentDBID, exists := c.Get("agent_db_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dbID, ok := agentDBID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid agent context"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	batch, err := ingest.ParseBatch(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.worker.Submit(&ingest.IngestJob{
		AgentDBID: dbID,
		Batch:     batch,
	})

	h.logger.Debug("ingest accepted",
		zap.String("batch_id", batch.BatchID),
		zap.Int("entries", len(batch.Entries)),
	)

	c.JSON(http.StatusAccepted, gin.H{
		"status":  "accepted",
		"entries": len(batch.Entries),
	})
}
