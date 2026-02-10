package ingest

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// RetentionJob periodically cleans up old request/response body data.
type RetentionJob struct {
	store         *store.Store
	retentionDays int
	interval      time.Duration
	logger        *zap.Logger
	stopCh        chan struct{}
}

// NewRetentionJob creates a new body data retention cleanup job.
func NewRetentionJob(s *store.Store, retentionDays int, logger *zap.Logger) *RetentionJob {
	return &RetentionJob{
		store:         s,
		retentionDays: retentionDays,
		interval:      6 * time.Hour,
		logger:        logger,
		stopCh:        make(chan struct{}),
	}
}

// Start begins the periodic cleanup in a background goroutine.
func (j *RetentionJob) Start() {
	go func() {
		ticker := time.NewTicker(j.interval)
		defer ticker.Stop()

		j.logger.Info("body retention cleanup started",
			zap.Int("retention_days", j.retentionDays),
			zap.Duration("interval", j.interval),
		)

		for {
			select {
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				affected, err := j.store.CleanupBodyData(ctx, j.retentionDays)
				cancel()
				if err != nil {
					j.logger.Error("body retention cleanup failed", zap.Error(err))
				} else if affected > 0 {
					j.logger.Info("body retention cleanup complete",
						zap.Int64("rows_cleaned", affected),
					)
				}
			case <-j.stopCh:
				j.logger.Info("body retention cleanup stopped")
				return
			}
		}
	}()
}

// Stop signals the retention job to stop.
func (j *RetentionJob) Stop() {
	close(j.stopCh)
}
