package ingest

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type IngestJob struct {
	AgentDBID uuid.UUID
	Batch     *LogBatch
}

type Worker struct {
	ch       chan *IngestJob
	enricher *Enricher
	workers  int
	wg       sync.WaitGroup
	logger   *zap.Logger
}

func NewWorker(enricher *Enricher, workers, bufferSize int, logger *zap.Logger) *Worker {
	if workers <= 0 {
		workers = 4
	}
	return &Worker{
		ch:       make(chan *IngestJob, bufferSize),
		enricher: enricher,
		workers:  workers,
		logger:   logger,
	}
}

// Submit adds an ingest job to the worker queue.
func (w *Worker) Submit(job *IngestJob) {
	select {
	case w.ch <- job:
	default:
		w.logger.Warn("ingest buffer full, dropping batch",
			zap.String("batch_id", job.Batch.BatchID),
		)
	}
}

// Start launches the worker goroutines.
func (w *Worker) Start() {
	w.logger.Info("starting ingest workers", zap.Int("workers", w.workers))

	for i := 0; i < w.workers; i++ {
		w.wg.Add(1)
		go w.run(i)
	}
}

// Stop gracefully shuts down the worker pool.
func (w *Worker) Stop() {
	close(w.ch)
	w.wg.Wait()
	w.logger.Info("ingest workers stopped")
}

func (w *Worker) run(id int) {
	defer w.wg.Done()
	w.logger.Debug("ingest worker started", zap.Int("worker_id", id))

	for job := range w.ch {
		ctx := context.Background()
		if err := w.enricher.Process(ctx, job.AgentDBID, job.Batch); err != nil {
			w.logger.Error("ingest job failed",
				zap.Int("worker_id", id),
				zap.String("batch_id", job.Batch.BatchID),
				zap.Error(err),
			)
		}
	}
}
