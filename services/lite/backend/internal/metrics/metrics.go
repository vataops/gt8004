package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ChannelsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ael_channels_active",
		Help: "Number of currently active channels",
	})

	ChannelsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_channels_total",
		Help: "Total number of channels created",
	})

	TransactionsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "ael_transactions_total",
		Help: "Total number of transactions processed",
	})

	TransactionLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "ael_transaction_latency_ms",
		Help:    "Transaction latency in milliseconds",
		Buckets: []float64{5, 10, 25, 50, 100, 250, 500, 1000},
	})

	CreditsInCirculation = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ael_credits_in_circulation",
		Help: "Total CREDIT tokens currently in circulation",
	})

	USDCInEscrow = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ael_usdc_in_escrow",
		Help: "Total USDC deposited in escrow",
	})
)
