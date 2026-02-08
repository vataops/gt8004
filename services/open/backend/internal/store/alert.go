package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// AlertRule represents a configured alert rule for an agent.
type AlertRule struct {
	ID            uuid.UUID `json:"id"`
	AgentID       uuid.UUID `json:"agent_id"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	Metric        string    `json:"metric"`
	Operator      string    `json:"operator"`
	Threshold     float64   `json:"threshold"`
	WindowMinutes int       `json:"window_minutes"`
	WebhookURL    *string   `json:"webhook_url,omitempty"`
	Enabled       bool      `json:"enabled"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// AlertHistory represents a triggered alert event.
type AlertHistory struct {
	ID          uuid.UUID `json:"id"`
	RuleID      uuid.UUID `json:"rule_id"`
	AgentID     uuid.UUID `json:"agent_id"`
	MetricValue float64   `json:"metric_value"`
	Threshold   float64   `json:"threshold"`
	Message     string    `json:"message"`
	Notified    bool      `json:"notified"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateAlertRule inserts a new alert rule and sets the generated ID on the rule.
func (s *Store) CreateAlertRule(ctx context.Context, rule *AlertRule) error {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO alert_rules (agent_id, name, type, metric, operator, threshold, window_minutes, webhook_url, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`, rule.AgentID, rule.Name, rule.Type, rule.Metric, rule.Operator, rule.Threshold, rule.WindowMinutes, rule.WebhookURL, rule.Enabled,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create alert rule: %w", err)
	}
	return nil
}

// GetAlertRules returns all alert rules for a given agent.
func (s *Store) GetAlertRules(ctx context.Context, agentDBID uuid.UUID) ([]AlertRule, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, name, type, metric, operator, threshold, window_minutes, webhook_url, enabled, created_at, updated_at
		FROM alert_rules
		WHERE agent_id = $1
		ORDER BY created_at DESC
	`, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(
			&r.ID, &r.AgentID, &r.Name, &r.Type, &r.Metric, &r.Operator,
			&r.Threshold, &r.WindowMinutes, &r.WebhookURL, &r.Enabled,
			&r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan alert rule: %w", err)
		}
		rules = append(rules, r)
	}

	if rules == nil {
		rules = []AlertRule{}
	}

	return rules, nil
}

// GetAlertRule returns a single alert rule by ID.
func (s *Store) GetAlertRule(ctx context.Context, ruleID uuid.UUID) (*AlertRule, error) {
	r := &AlertRule{}
	err := s.pool.QueryRow(ctx, `
		SELECT id, agent_id, name, type, metric, operator, threshold, window_minutes, webhook_url, enabled, created_at, updated_at
		FROM alert_rules
		WHERE id = $1
	`, ruleID).Scan(
		&r.ID, &r.AgentID, &r.Name, &r.Type, &r.Metric, &r.Operator,
		&r.Threshold, &r.WindowMinutes, &r.WebhookURL, &r.Enabled,
		&r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get alert rule: %w", err)
	}
	return r, nil
}

// UpdateAlertRule updates an existing alert rule.
func (s *Store) UpdateAlertRule(ctx context.Context, rule *AlertRule) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE alert_rules
		SET name = $2, type = $3, metric = $4, operator = $5, threshold = $6,
			window_minutes = $7, webhook_url = $8, enabled = $9, updated_at = NOW()
		WHERE id = $1
	`, rule.ID, rule.Name, rule.Type, rule.Metric, rule.Operator, rule.Threshold,
		rule.WindowMinutes, rule.WebhookURL, rule.Enabled,
	)
	if err != nil {
		return fmt.Errorf("update alert rule: %w", err)
	}
	return nil
}

// DeleteAlertRule deletes an alert rule by ID.
func (s *Store) DeleteAlertRule(ctx context.Context, ruleID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM alert_rules WHERE id = $1
	`, ruleID)
	if err != nil {
		return fmt.Errorf("delete alert rule: %w", err)
	}
	return nil
}

// GetEnabledAlertRules returns all enabled alert rules across all agents.
func (s *Store) GetEnabledAlertRules(ctx context.Context) ([]AlertRule, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, agent_id, name, type, metric, operator, threshold, window_minutes, webhook_url, enabled, created_at, updated_at
		FROM alert_rules
		WHERE enabled = TRUE
		ORDER BY agent_id, created_at
	`)
	if err != nil {
		return nil, fmt.Errorf("get enabled alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(
			&r.ID, &r.AgentID, &r.Name, &r.Type, &r.Metric, &r.Operator,
			&r.Threshold, &r.WindowMinutes, &r.WebhookURL, &r.Enabled,
			&r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan enabled alert rule: %w", err)
		}
		rules = append(rules, r)
	}

	if rules == nil {
		rules = []AlertRule{}
	}

	return rules, nil
}

// InsertAlertHistory inserts a triggered alert event.
func (s *Store) InsertAlertHistory(ctx context.Context, history *AlertHistory) error {
	err := s.pool.QueryRow(ctx, `
		INSERT INTO alert_history (rule_id, agent_id, metric_value, threshold, message, notified)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, history.RuleID, history.AgentID, history.MetricValue, history.Threshold, history.Message, history.Notified,
	).Scan(&history.ID, &history.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert alert history: %w", err)
	}
	return nil
}

// GetAlertHistory returns recent alert history for an agent.
func (s *Store) GetAlertHistory(ctx context.Context, agentDBID uuid.UUID, limit int) ([]AlertHistory, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, rule_id, agent_id, metric_value, threshold, message, notified, created_at
		FROM alert_history
		WHERE agent_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, agentDBID, limit)
	if err != nil {
		return nil, fmt.Errorf("get alert history: %w", err)
	}
	defer rows.Close()

	var history []AlertHistory
	for rows.Next() {
		var h AlertHistory
		if err := rows.Scan(
			&h.ID, &h.RuleID, &h.AgentID, &h.MetricValue, &h.Threshold, &h.Message, &h.Notified, &h.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan alert history: %w", err)
		}
		history = append(history, h)
	}

	if history == nil {
		history = []AlertHistory{}
	}

	return history, nil
}
