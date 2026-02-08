package alert

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/AEL/ael-open/internal/analytics"
	"github.com/AEL/ael-open/internal/store"
)

// Engine periodically evaluates all enabled alert rules.
type Engine struct {
	store    *store.Store
	perf     *analytics.PerformanceAnalytics
	notifier *Notifier
	logger   *zap.Logger
	interval time.Duration
	stopCh   chan struct{}
}

// NewEngine creates a new alert evaluation engine.
func NewEngine(
	s *store.Store,
	perfAnalytics *analytics.PerformanceAnalytics,
	notifier *Notifier,
	logger *zap.Logger,
	interval time.Duration,
) *Engine {
	return &Engine{
		store:    s,
		perf:     perfAnalytics,
		notifier: notifier,
		logger:   logger,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic alert evaluation loop in a background goroutine.
func (e *Engine) Start() {
	go func() {
		ticker := time.NewTicker(e.interval)
		defer ticker.Stop()

		e.logger.Info("alert engine started", zap.Duration("interval", e.interval))

		for {
			select {
			case <-ticker.C:
				e.evaluate()
			case <-e.stopCh:
				e.logger.Info("alert engine stopped")
				return
			}
		}
	}()
}

// Stop signals the engine to stop evaluating.
func (e *Engine) Stop() {
	close(e.stopCh)
}

// evaluate checks all enabled rules and fires alerts when thresholds are exceeded.
func (e *Engine) evaluate() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rules, err := e.store.GetEnabledAlertRules(ctx)
	if err != nil {
		e.logger.Error("failed to get enabled alert rules", zap.Error(err))
		return
	}

	if len(rules) == 0 {
		return
	}

	e.logger.Debug("evaluating alert rules", zap.Int("count", len(rules)))

	for _, rule := range rules {
		value, err := e.perf.GetMetricValue(ctx, rule.AgentID, rule.Metric, rule.WindowMinutes)
		if err != nil {
			e.logger.Warn("failed to get metric value for rule",
				zap.String("rule_id", rule.ID.String()),
				zap.String("metric", rule.Metric),
				zap.Error(err),
			)
			continue
		}

		triggered := Evaluate(value, Operator(rule.Operator), rule.Threshold)
		if !triggered {
			continue
		}

		message := fmt.Sprintf("Alert '%s': %s is %.4f (threshold: %s %.4f)",
			rule.Name, rule.Metric, value, rule.Operator, rule.Threshold,
		)

		e.logger.Info("alert triggered",
			zap.String("rule_id", rule.ID.String()),
			zap.String("rule_name", rule.Name),
			zap.String("metric", rule.Metric),
			zap.Float64("value", value),
			zap.Float64("threshold", rule.Threshold),
		)

		notified := false

		// Send webhook if configured
		if rule.WebhookURL != nil && *rule.WebhookURL != "" {
			payload := &WebhookPayload{
				RuleName:    rule.Name,
				Metric:      rule.Metric,
				Value:       value,
				Threshold:   rule.Threshold,
				Operator:    rule.Operator,
				Message:     message,
				TriggeredAt: time.Now().UTC().Format(time.RFC3339),
			}

			if err := e.notifier.Send(ctx, *rule.WebhookURL, payload); err != nil {
				e.logger.Warn("failed to send webhook notification",
					zap.String("rule_id", rule.ID.String()),
					zap.Error(err),
				)
			} else {
				notified = true
			}
		}

		// Record in alert history
		history := &store.AlertHistory{
			RuleID:      rule.ID,
			AgentID:     rule.AgentID,
			MetricValue: value,
			Threshold:   rule.Threshold,
			Message:     message,
			Notified:    notified,
		}

		if err := e.store.InsertAlertHistory(ctx, history); err != nil {
			e.logger.Error("failed to insert alert history",
				zap.String("rule_id", rule.ID.String()),
				zap.Error(err),
			)
		}
	}
}
