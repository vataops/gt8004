package alert

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// Notifier sends webhook notifications for triggered alerts.
type Notifier struct {
	client *http.Client
	logger *zap.Logger
}

// WebhookPayload is the JSON body sent to webhook URLs when an alert fires.
type WebhookPayload struct {
	RuleName    string  `json:"rule_name"`
	Metric      string  `json:"metric"`
	Value       float64 `json:"value"`
	Threshold   float64 `json:"threshold"`
	Operator    string  `json:"operator"`
	Message     string  `json:"message"`
	TriggeredAt string  `json:"triggered_at"`
}

// NewNotifier creates a new Notifier with a default HTTP client.
func NewNotifier(logger *zap.Logger) *Notifier {
	return &Notifier{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		logger: logger,
	}
}

// Send posts the webhook payload as JSON to the given URL.
func (n *Notifier) Send(ctx context.Context, webhookURL string, payload *WebhookPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	n.logger.Debug("webhook notification sent",
		zap.String("url", webhookURL),
		zap.String("rule", payload.RuleName),
		zap.Int("status", resp.StatusCode),
	)

	return nil
}
