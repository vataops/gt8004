package store

import (
	"context"
	"fmt"
)

// CleanupBodyData nullifies request/response bodies older than the retention period.
func (s *Store) CleanupBodyData(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 30
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE request_logs
		SET request_body = NULL, response_body = NULL
		WHERE created_at < NOW() - make_interval(days => $1)
		  AND (request_body IS NOT NULL OR response_body IS NOT NULL)
	`, retentionDays)
	if err != nil {
		return 0, fmt.Errorf("cleanup body data: %w", err)
	}
	return tag.RowsAffected(), nil
}
