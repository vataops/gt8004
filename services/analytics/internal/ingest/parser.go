package ingest

import (
	"encoding/json"
	"fmt"
)

type LogBatch struct {
	AgentID    string     `json:"agent_id"`
	SDKVersion string     `json:"sdk_version"`
	BatchID    string     `json:"batch_id"`
	Entries    []LogEntry `json:"entries"`
}

type LogEntry struct {
	RequestID        string   `json:"requestId"`
	CustomerID       *string  `json:"customerId,omitempty"`
	ToolName         *string  `json:"toolName,omitempty"`
	Method           string   `json:"method"`
	Path             string   `json:"path"`
	StatusCode       int      `json:"statusCode"`
	ResponseMs       float32  `json:"responseMs"`
	ErrorType        *string  `json:"errorType,omitempty"`
	X402Amount       *float64 `json:"x402Amount,omitempty"`
	X402TxHash       *string  `json:"x402TxHash,omitempty"`
	X402Token        *string  `json:"x402Token,omitempty"`
	X402Payer        *string  `json:"x402Payer,omitempty"`
	RequestBodySize  *int     `json:"requestBodySize,omitempty"`
	ResponseBodySize *int     `json:"responseBodySize,omitempty"`
	RequestBody      *string          `json:"requestBody,omitempty"`
	ResponseBody     *string          `json:"responseBody,omitempty"`
	Headers          *json.RawMessage `json:"headers,omitempty"`
	Protocol         *string          `json:"protocol,omitempty"`
	Source           *string  `json:"source,omitempty"`
	IPAddress        *string  `json:"ipAddress,omitempty"`
	UserAgent        *string  `json:"userAgent,omitempty"`
	Referer          *string  `json:"referer,omitempty"`
	ContentType      *string  `json:"contentType,omitempty"`
	AcceptLanguage   *string  `json:"acceptLanguage,omitempty"`
	Country          *string  `json:"country,omitempty"`
	City             *string  `json:"city,omitempty"`
	Timestamp        string   `json:"timestamp"`
}

// ParseBatch parses a JSON-encoded log batch.
func ParseBatch(data []byte) (*LogBatch, error) {
	var batch LogBatch
	if err := json.Unmarshal(data, &batch); err != nil {
		return nil, fmt.Errorf("parse log batch: %w", err)
	}

	if len(batch.Entries) == 0 {
		return nil, fmt.Errorf("empty log batch")
	}

	return &batch, nil
}
