package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ChannelsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aes_channels_active",
		Help: "Number of currently active channels",
	})

	ChannelsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "aes_channels_total",
		Help: "Total number of channels created",
	})

	TransactionsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "aes_transactions_total",
		Help: "Total number of transactions processed",
	})

	TransactionLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "aes_transaction_latency_ms",
		Help:    "Transaction latency in milliseconds",
		Buckets: []float64{5, 10, 25, 50, 100, 250, 500, 1000},
	})

	CreditsInCirculation = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aes_credits_in_circulation",
		Help: "Total CREDIT tokens currently in circulation",
	})

	USDCInEscrow = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "aes_usdc_in_escrow",
		Help: "Total USDC deposited in escrow",
	})
)
