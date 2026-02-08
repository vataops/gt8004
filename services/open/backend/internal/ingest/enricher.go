package ingest

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/AEL/ael-open/internal/store"
)

type Enricher struct {
	store  *store.Store
	logger *zap.Logger
}

func NewEnricher(s *store.Store, logger *zap.Logger) *Enricher {
	return &Enricher{
		store:  s,
		logger: logger,
	}
}

// customerStats holds aggregated per-customer stats from a batch.
type customerStats struct {
	requestCount int64
	revenue      float64
	totalMs      float64
	errorCount   int64
}

// Process inserts log entries into the database, updates agent stats,
// upserts customer records, and inserts revenue entries.
func (e *Enricher) Process(ctx context.Context, agentDBID uuid.UUID, batch *LogBatch) error {
	// Convert log entries to store format
	logs := make([]store.RequestLog, len(batch.Entries))
	var totalRevenue float64

	// Track per-customer stats for upsert
	custStats := make(map[string]*customerStats)

	for i, entry := range batch.Entries {
		logs[i] = store.RequestLog{
			AgentID:          agentDBID,
			RequestID:        entry.RequestID,
			CustomerID:       entry.CustomerID,
			ToolName:         entry.ToolName,
			Method:           entry.Method,
			Path:             entry.Path,
			StatusCode:       entry.StatusCode,
			ResponseMs:       entry.ResponseMs,
			ErrorType:        entry.ErrorType,
			X402Amount:       entry.X402Amount,
			X402TxHash:       entry.X402TxHash,
			X402Token:        entry.X402Token,
			X402Payer:        entry.X402Payer,
			RequestBodySize:  entry.RequestBodySize,
			ResponseBodySize: entry.ResponseBodySize,
			BatchID:          batch.BatchID,
			SDKVersion:       batch.SDKVersion,
		}

		if entry.X402Amount != nil {
			totalRevenue += *entry.X402Amount
		}

		// Aggregate per-customer stats
		if entry.CustomerID != nil && *entry.CustomerID != "" {
			cid := *entry.CustomerID
			cs, ok := custStats[cid]
			if !ok {
				cs = &customerStats{}
				custStats[cid] = cs
			}
			cs.requestCount++
			cs.totalMs += float64(entry.ResponseMs)
			if entry.StatusCode >= 400 {
				cs.errorCount++
			}
			if entry.X402Amount != nil {
				cs.revenue += *entry.X402Amount
			}
		}
	}

	// Batch insert request logs
	if err := e.store.InsertRequestLogs(ctx, agentDBID, logs); err != nil {
		e.logger.Error("failed to insert request logs",
			zap.Error(err),
			zap.String("batch_id", batch.BatchID),
		)
		return err
	}

	// Update agent aggregate stats
	if err := e.store.UpdateAgentStats(ctx, agentDBID, len(batch.Entries), totalRevenue); err != nil {
		e.logger.Error("failed to update agent stats",
			zap.Error(err),
			zap.String("batch_id", batch.BatchID),
		)
		return err
	}

	// Upsert customer records
	for cid, cs := range custStats {
		avgMs := float32(0)
		if cs.requestCount > 0 {
			avgMs = float32(cs.totalMs / float64(cs.requestCount))
		}
		errorRate := float32(0)
		if cs.requestCount > 0 {
			errorRate = float32(float64(cs.errorCount) / float64(cs.requestCount))
		}

		if err := e.store.UpsertCustomer(ctx, agentDBID, cid, cs.requestCount, cs.revenue, avgMs, errorRate); err != nil {
			e.logger.Error("failed to upsert customer",
				zap.Error(err),
				zap.String("customer_id", cid),
				zap.String("batch_id", batch.BatchID),
			)
			// Non-fatal: continue processing other customers
		}
	}

	// Insert revenue entries for x402 payments
	for _, entry := range batch.Entries {
		if entry.X402Amount != nil && *entry.X402Amount > 0 {
			re := store.RevenueEntry{
				AgentID:      agentDBID,
				CustomerID:   entry.CustomerID,
				ToolName:     entry.ToolName,
				Amount:       *entry.X402Amount,
				Currency:     "USDC",
				TxHash:       entry.X402TxHash,
				PayerAddress: entry.X402Payer,
			}
			if err := e.store.InsertRevenueEntry(ctx, re); err != nil {
				e.logger.Error("failed to insert revenue entry",
					zap.Error(err),
					zap.String("batch_id", batch.BatchID),
				)
				// Non-fatal: continue processing
			}
		}
	}

	// Update agent total_customers count
	if len(custStats) > 0 {
		count, err := e.store.GetDistinctCustomerCount(ctx, agentDBID)
		if err != nil {
			e.logger.Error("failed to get distinct customer count",
				zap.Error(err),
				zap.String("batch_id", batch.BatchID),
			)
		} else {
			if err := e.store.UpdateAgentTotalCustomers(ctx, agentDBID, count); err != nil {
				e.logger.Error("failed to update agent total customers",
					zap.Error(err),
					zap.String("batch_id", batch.BatchID),
				)
			}
		}
	}

	e.logger.Debug("batch processed",
		zap.String("batch_id", batch.BatchID),
		zap.Int("entries", len(batch.Entries)),
		zap.Float64("revenue", totalRevenue),
		zap.Int("unique_customers", len(custStats)),
	)

	return nil
}
