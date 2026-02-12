package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type Store struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func New(ctx context.Context, databaseURL string, logger *zap.Logger) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}
	logger.Info("ingest store connected to database")
	return &Store{pool: pool, logger: logger}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}
