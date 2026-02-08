package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	AgentsRegistered = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_open_agents_registered_total",
		Help: "Total number of agents registered",
	})

	AgentsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ael_open_agents_active",
		Help: "Number of currently active agents",
	})

	IngestBatchesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_open_ingest_batches_total",
		Help: "Total number of log batches ingested",
	})

	IngestEntriesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_open_ingest_entries_total",
		Help: "Total number of log entries ingested",
	})

	IngestLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "ael_open_ingest_latency_ms",
		Help:    "Ingest processing latency in milliseconds",
		Buckets: []float64{5, 10, 25, 50, 100, 250, 500, 1000},
	})

	RequestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_open_requests_total",
		Help: "Total API requests processed",
	})

	RevenueUSDC = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_open_revenue_usdc_total",
		Help: "Total USDC revenue tracked across all agents",
	})
)
