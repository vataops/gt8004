package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

type RequestLog struct {
	AgentID          uuid.UUID        `json:"agent_id"`
	RequestID        string           `json:"request_id"`
	ToolName         *string          `json:"tool_name,omitempty"`
	Method           string           `json:"method"`
	Path             string           `json:"path"`
	StatusCode       int              `json:"status_code"`
	ResponseMs       float32          `json:"response_ms"`
	ErrorType        *string          `json:"error_type,omitempty"`
	X402Amount       *float64         `json:"x402_amount,omitempty"`
	X402TxHash       *string          `json:"x402_tx_hash,omitempty"`
	X402Token        *string          `json:"x402_token,omitempty"`
	X402Payer        *string          `json:"x402_payer,omitempty"`
	RequestBodySize  *int             `json:"request_body_size,omitempty"`
	ResponseBodySize *int             `json:"response_body_size,omitempty"`
	RequestBody      *string          `json:"request_body,omitempty"`
	ResponseBody     *string          `json:"response_body,omitempty"`
	Headers          *json.RawMessage `json:"headers,omitempty"`
	BatchID          string           `json:"batch_id"`
	SDKVersion       string           `json:"sdk_version"`
	Protocol         *string          `json:"protocol,omitempty"`
	Source           *string          `json:"source,omitempty"`
	IPAddress        *string          `json:"ip_address,omitempty"`
	UserAgent        *string          `json:"user_agent,omitempty"`
	Referer          *string          `json:"referer,omitempty"`
	ContentType      *string          `json:"content_type,omitempty"`
	AcceptLanguage   *string          `json:"accept_language,omitempty"`
	Country          *string          `json:"country,omitempty"`
	City             *string          `json:"city,omitempty"`
}

// InsertRequestLogs batch-inserts request log entries for an agent.
func (s *Store) InsertRequestLogs(ctx context.Context, agentDBID uuid.UUID, entries []RequestLog) error {
	if len(entries) == 0 {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, e := range entries {
		_, err := tx.Exec(ctx, `
			INSERT INTO request_logs (
				agent_id, request_id, tool_name, method, path,
				status_code, response_ms, error_type,
				x402_amount, x402_tx_hash, x402_token, x402_payer,
				request_body_size, response_body_size,
				request_body, response_body, headers,
				batch_id, sdk_version, protocol, source,
				ip_address, user_agent, referer, content_type, accept_language,
				country, city
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
		`,
			agentDBID, e.RequestID, e.ToolName, e.Method, e.Path,
			e.StatusCode, e.ResponseMs, e.ErrorType,
			e.X402Amount, e.X402TxHash, e.X402Token, e.X402Payer,
			e.RequestBodySize, e.ResponseBodySize,
			e.RequestBody, e.ResponseBody, e.Headers,
			e.BatchID, e.SDKVersion, e.Protocol, e.Source,
			e.IPAddress, e.UserAgent, e.Referer, e.ContentType, e.AcceptLanguage,
			e.Country, e.City,
		)
		if err != nil {
			return fmt.Errorf("insert request log: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	return nil
}
