package analytics

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/AEL/aes-open/internal/store"
)

// RevenueReport aggregates all revenue analytics for an agent.
type RevenueReport struct {
	Periods      []store.RevenuePeriod `json:"periods"`
	ByTool       []store.RevenueByTool `json:"by_tool"`
	ARPU         float64               `json:"arpu"`
	TotalRevenue float64               `json:"total_revenue"`
}

// RevenueAnalytics provides revenue intelligence operations.
type RevenueAnalytics struct {
	store  *store.Store
	logger *zap.Logger
}

// NewRevenueAnalytics creates a new RevenueAnalytics instance.
func NewRevenueAnalytics(s *store.Store, logger *zap.Logger) *RevenueAnalytics {
	return &RevenueAnalytics{
		store:  s,
		logger: logger,
	}
}

// GetRevenueReport combines period data, by-tool breakdown, ARPU, and total revenue.
func (ra *RevenueAnalytics) GetRevenueReport(ctx context.Context, agentDBID uuid.UUID, period string) (*RevenueReport, error) {
	periods, err := ra.store.GetRevenueByPeriod(ctx, agentDBID, period)
	if err != nil {
		return nil, fmt.Errorf("get revenue periods: %w", err)
	}

	byTool, err := ra.store.GetRevenueByTool(ctx, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get revenue by tool: %w", err)
	}

	arpu, err := ra.store.GetARPU(ctx, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get arpu: %w", err)
	}

	// Calculate total revenue from all periods
	var totalRevenue float64
	for _, p := range periods {
		totalRevenue += p.Amount
	}

	report := &RevenueReport{
		Periods:      periods,
		ByTool:       byTool,
		ARPU:         arpu,
		TotalRevenue: totalRevenue,
	}

	ra.logger.Debug("revenue report generated",
		zap.String("agent_db_id", agentDBID.String()),
		zap.String("period", period),
		zap.Float64("total_revenue", totalRevenue),
	)

	return report, nil
}
