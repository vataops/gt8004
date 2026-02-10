package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// LogBatch matches the ingest.LogBatch format expected by the Analytics service.
type LogBatch struct {
	AgentID    string     `json:"agent_id"`
	SDKVersion string     `json:"sdk_version"`
	BatchID    string     `json:"batch_id"`
	Entries    []LogEntry `json:"entries"`
}

// LogEntry matches the ingest.LogEntry format.
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
	RequestBodySize  *int             `json:"requestBodySize,omitempty"`
	ResponseBodySize *int             `json:"responseBodySize,omitempty"`
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

// IngestRequest wraps a batch with the agent DB ID for the internal API.
type IngestRequest struct {
	AgentDBID uuid.UUID `json:"agent_db_id"`
	Batch     *LogBatch `json:"batch"`
}

// AnalyticsClient sends log data to the Analytics service via HTTP.
type AnalyticsClient struct {
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
	queue      chan *IngestRequest
}

func NewAnalyticsClient(baseURL string, logger *zap.Logger) *AnalyticsClient {
	c := &AnalyticsClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
		queue:  make(chan *IngestRequest, 1000),
	}
	// Start async sender
	go c.sender()
	return c
}

// Submit queues a log batch for async delivery to Analytics.
func (c *AnalyticsClient) Submit(req *IngestRequest) {
	select {
	case c.queue <- req:
	default:
		c.logger.Warn("analytics queue full, dropping batch",
			zap.String("batch_id", req.Batch.BatchID),
		)
	}
}

func (c *AnalyticsClient) sender() {
	for req := range c.queue {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := c.send(ctx, req); err != nil {
			c.logger.Error("failed to send logs to analytics",
				zap.String("batch_id", req.Batch.BatchID),
				zap.Error(err),
			)
		}
		cancel()
	}
}

func (c *AnalyticsClient) send(ctx context.Context, req *IngestRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal ingest request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/ingest", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("analytics request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("analytics returned status %d", resp.StatusCode)
	}

	return nil
}
