package analytics

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/AEL/aes-open/internal/store"
)

// Cohort represents a monthly customer cohort with retention data.
type Cohort struct {
	Month             string `json:"month"`
	NewCustomers      int    `json:"new_customers"`
	RetainedCustomers int    `json:"retained_customers"`
}

// CustomerAnalytics provides customer intelligence operations.
type CustomerAnalytics struct {
	store  *store.Store
	logger *zap.Logger
}

// NewCustomerAnalytics creates a new CustomerAnalytics instance.
func NewCustomerAnalytics(s *store.Store, logger *zap.Logger) *CustomerAnalytics {
	return &CustomerAnalytics{
		store:  s,
		logger: logger,
	}
}

// RefreshChurnRisk recalculates churn risk for all customers of an agent.
func (ca *CustomerAnalytics) RefreshChurnRisk(ctx context.Context, agentDBID uuid.UUID) error {
	if err := ca.store.UpdateChurnRisk(ctx, agentDBID); err != nil {
		return fmt.Errorf("refresh churn risk: %w", err)
	}
	ca.logger.Debug("churn risk refreshed", zap.String("agent_db_id", agentDBID.String()))
	return nil
}

// GetCohortAnalysis returns monthly cohort analysis for an agent.
// Each cohort includes new customers and retained customers (those still active).
func (ca *CustomerAnalytics) GetCohortAnalysis(ctx context.Context, agentDBID uuid.UUID) ([]Cohort, error) {
	storeCohorts, err := ca.store.GetCustomerCohorts(ctx, agentDBID)
	if err != nil {
		return nil, fmt.Errorf("get cohort analysis: %w", err)
	}

	cohorts := make([]Cohort, len(storeCohorts))
	for i, sc := range storeCohorts {
		cohorts[i] = Cohort{
			Month:             sc.Month,
			NewCustomers:      sc.NewCustomers,
			RetainedCustomers: sc.NewCustomers, // initial: all new are retained; enriched by churn later
		}
	}

	if cohorts == nil {
		cohorts = []Cohort{}
	}

	return cohorts, nil
}
