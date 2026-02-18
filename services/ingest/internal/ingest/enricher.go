package ingest

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-ingest/internal/store"
)

type Enricher struct {
	store       *store.Store
	verifier    *Verifier
	logger      *zap.Logger
	maxBodySize int
}

func NewEnricher(s *store.Store, v *Verifier, logger *zap.Logger, maxBodySize int) *Enricher {
	if maxBodySize <= 0 {
		maxBodySize = 51200 // 50KB default
	}
	return &Enricher{
		store:       s,
		verifier:    v,
		logger:      logger,
		maxBodySize: maxBodySize,
	}
}

// normalizeProtocol ensures only valid protocol values are stored.
func normalizeProtocol(p *string) *string {
	if p == nil {
		return nil
	}
	switch *p {
	case "mcp", "a2a", "http":
		return p
	default:
		def := "http"
		return &def
	}
}

// customerStats holds aggregated per-customer stats from a batch.
type customerStats struct {
	requestCount int64
	revenue      float64
	totalMs      float64
	errorCount   int64
	country      string
	city         string
}

// Process inserts log entries into the database, updates agent stats,
// upserts customer records, and inserts revenue entries.
func (e *Enricher) Process(ctx context.Context, agentDBID uuid.UUID, chainID int, batch *LogBatch) error {
	// Filter out sdk_ping entries and update connection status
	realEntries := make([]LogEntry, 0, len(batch.Entries))
	for _, entry := range batch.Entries {
		if entry.Source != nil && *entry.Source == "sdk_ping" {
			if err := e.store.UpdateAgentSDKConnected(ctx, agentDBID); err != nil {
				e.logger.Error("failed to update agent sdk connected",
					zap.Error(err), zap.String("agent_db_id", agentDBID.String()))
			} else {
				e.logger.Info("sdk ping received",
					zap.String("agent_db_id", agentDBID.String()),
					zap.String("sdk_version", batch.SDKVersion))
			}
			continue
		}
		realEntries = append(realEntries, entry)
	}

	// If only ping entries, we're done
	if len(realEntries) == 0 {
		return nil
	}
	batch.Entries = realEntries

	logs := make([]store.RequestLog, len(batch.Entries))
	var totalRevenue float64

	sourceStr := "sdk"

	custStats := make(map[string]*customerStats)

	for i, entry := range batch.Entries {
		entrySource := &sourceStr
		if entry.Source != nil {
			entrySource = entry.Source
		}

		reqBody := entry.RequestBody
		if reqBody != nil && len(*reqBody) > e.maxBodySize {
			truncated := (*reqBody)[:e.maxBodySize]
			reqBody = &truncated
		}
		respBody := entry.ResponseBody
		if respBody != nil && len(*respBody) > e.maxBodySize {
			truncated := (*respBody)[:e.maxBodySize]
			respBody = &truncated
		}

		logs[i] = store.RequestLog{
			AgentID:          agentDBID,
			RequestID:        entry.RequestID,
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
			RequestBody:      reqBody,
			ResponseBody:     respBody,
			Headers:          entry.Headers,
			BatchID:          batch.BatchID,
			SDKVersion:       batch.SDKVersion,
			Protocol:         normalizeProtocol(entry.Protocol),
			Source:           entrySource,
			IPAddress:        entry.IPAddress,
			UserAgent:        entry.UserAgent,
			Referer:          entry.Referer,
			ContentType:      entry.ContentType,
			AcceptLanguage:   entry.AcceptLanguage,
			Country:          entry.Country,
			City:             entry.City,
		}

		if entry.X402Amount != nil {
			totalRevenue += *entry.X402Amount
		}

		if logs[i].IPAddress != nil && *logs[i].IPAddress != "" {
			cid := *logs[i].IPAddress
			cs, ok := custStats[cid]
			if !ok {
				cs = &customerStats{}
				custStats[cid] = cs
				if logs[i].Country != nil {
					cs.country = *logs[i].Country
				}
				if logs[i].City != nil {
					cs.city = *logs[i].City
				}
			}
			cs.requestCount++
			cs.totalMs += float64(entry.ResponseMs)
			if entry.StatusCode >= 400 && entry.StatusCode != 402 {
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
			zap.Error(err), zap.String("batch_id", batch.BatchID))
		return err
	}

	// Update agent aggregate stats
	if err := e.store.UpdateAgentStats(ctx, agentDBID, len(batch.Entries), totalRevenue); err != nil {
		e.logger.Error("failed to update agent stats",
			zap.Error(err), zap.String("batch_id", batch.BatchID))
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
		if err := e.store.UpsertCustomer(ctx, agentDBID, cid, cs.requestCount, cs.revenue, avgMs, errorRate, cs.country, cs.city); err != nil {
			e.logger.Error("failed to upsert customer",
				zap.Error(err), zap.String("customer_id", cid), zap.String("batch_id", batch.BatchID))
		}
	}

	// Insert revenue entries for x402 payments
	for _, entry := range batch.Entries {
		if entry.X402Amount != nil && *entry.X402Amount > 0 {
			re := store.RevenueEntry{
				AgentID:      agentDBID,
				CustomerID:   entry.IPAddress,
				ToolName:     entry.ToolName,
				Amount:       *entry.X402Amount,
				Currency:     "USDC",
				TxHash:       entry.X402TxHash,
				PayerAddress: entry.X402Payer,
			}
			entryID, err := e.store.InsertRevenueEntryReturningID(ctx, re)
			if err != nil {
				e.logger.Error("failed to insert revenue entry",
					zap.Error(err), zap.String("batch_id", batch.BatchID))
				continue
			}
			// Async on-chain verification
			if e.verifier != nil && entry.X402TxHash != nil && *entry.X402TxHash != "" && chainID > 0 {
				txHash := *entry.X402TxHash
				amount := *entry.X402Amount
				var payer string
				if entry.X402Payer != nil {
					payer = *entry.X402Payer
				}
				go e.verifier.VerifyPayment(context.Background(), entryID, txHash, amount, payer, chainID)
			}
		}
	}

	// Update agent total_customers count
	if len(custStats) > 0 {
		count, err := e.store.GetDistinctCustomerCount(ctx, agentDBID)
		if err != nil {
			e.logger.Error("failed to get distinct customer count",
				zap.Error(err), zap.String("batch_id", batch.BatchID))
		} else {
			if err := e.store.UpdateAgentTotalCustomers(ctx, agentDBID, count); err != nil {
				e.logger.Error("failed to update agent total customers",
					zap.Error(err), zap.String("batch_id", batch.BatchID))
			}
		}
	}

	e.logger.Debug("batch processed",
		zap.String("batch_id", batch.BatchID),
		zap.Int("entries", len(batch.Entries)),
		zap.Float64("revenue", totalRevenue),
		zap.Int("unique_customers", len(custStats)))

	return nil
}
