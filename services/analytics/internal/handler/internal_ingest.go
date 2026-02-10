package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/ingest"
)

// InternalIngestRequest is the payload from Gateway -> Analytics.
type InternalIngestRequest struct {
	AgentDBID string       `json:"agent_db_id" binding:"required"`
	Batch     ingest.LogBatch `json:"batch" binding:"required"`
}

// InternalIngest handles POST /internal/ingest (Gateway -> Analytics).
func (h *Handler) InternalIngest(c *gin.Context) {
	var req InternalIngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dbID, err := uuid.Parse(req.AgentDBID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent_db_id"})
		return
	}

	if len(req.Batch.Entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty batch"})
		return
	}

	h.worker.Submit(&ingest.IngestJob{
		AgentDBID: dbID,
		AgentID:   req.Batch.AgentID,
		Batch:     &req.Batch,
	})

	h.logger.Debug("internal ingest accepted",
		zap.String("agent_db_id", req.AgentDBID),
		zap.String("batch_id", req.Batch.BatchID),
		zap.Int("entries", len(req.Batch.Entries)),
	)

	c.JSON(http.StatusAccepted, gin.H{
		"status":  "accepted",
		"entries": len(req.Batch.Entries),
	})
}
