package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// AgentStats handles GET /v1/agents/:agent_id/stats.
func (h *Handler) AgentStats(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	cacheKey := fmt.Sprintf("agent:%s:stats", c.Param("agent_id"))

	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	stats, err := h.store.GetAgentStats(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get agent stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	data, _ := json.Marshal(stats)
	h.cache.Set(c.Request.Context(), cacheKey, data, 10*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// AgentDailyStats handles GET /v1/agents/:agent_id/stats/daily.
func (h *Handler) AgentDailyStats(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	days := 30
	if d := c.Query("days"); d != "" {
		parsed, err := strconv.Atoi(d)
		if err == nil && parsed > 0 && parsed <= 365 {
			days = parsed
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:daily:%d", c.Param("agent_id"), days)

	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	stats, err := h.store.GetDailyStats(c.Request.Context(), dbID, days)
	if err != nil {
		h.logger.Error("failed to get daily stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get daily stats"})
		return
	}

	resp := gin.H{"stats": stats}
	data, _ := json.Marshal(resp)
	h.cache.Set(c.Request.Context(), cacheKey, data, 60*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// ---------- Analytics Report ----------

type AnalyticsRevenueSummary struct {
	TotalRevenue   float64 `json:"total_revenue"`
	PaymentCount   int64   `json:"payment_count"`
	RequiredCount  int64   `json:"required_count"`
	ConversionRate float64 `json:"conversion_rate"`
	AvgPerRequest  float64 `json:"avg_per_request"`
	ARPU           float64 `json:"arpu"`
}

type AnalyticsReportResponse struct {
	Protocol     []store.ProtocolStats      `json:"protocol"`
	ToolRanking  []store.ToolUsage          `json:"tool_ranking"`
	Health       *store.HealthMetrics       `json:"health"`
	Customers    *store.CustomerIntelligence `json:"customers"`
	Revenue      *AnalyticsRevenueSummary   `json:"revenue"`
	DailyByProto []store.DailyProtocolStats `json:"daily_by_protocol"`
	MCPTools     []store.ToolUsage          `json:"mcp_tools"`
	A2APartners  []store.A2APartner         `json:"a2a_partners"`
	A2AEndpoints []store.EndpointStats      `json:"a2a_endpoints"`
}

// AnalyticsReport handles GET /v1/agents/:agent_id/analytics?days=30
func (h *Handler) AnalyticsReport(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	days := 30
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 90 {
			days = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:analytics:%d", c.Param("agent_id"), days)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	ctx := c.Request.Context()
	g, gctx := errgroup.WithContext(ctx)

	var protocolStats []store.ProtocolStats
	var toolUsage []store.ToolUsage
	var healthMetrics *store.HealthMetrics
	var customerIntel *store.CustomerIntelligence
	var dailyProto []store.DailyProtocolStats
	var agentStats *store.AgentStats
	var mcpTools []store.ToolUsage
	var a2aPartners []store.A2APartner
	var a2aEndpoints []store.EndpointStats

	g.Go(func() error {
		var err error
		protocolStats, err = h.store.GetProtocolBreakdown(gctx, dbID, days)
		return err
	})
	g.Go(func() error {
		var err error
		toolUsage, err = h.store.GetToolUsageRanking(gctx, dbID, days, 20)
		return err
	})
	g.Go(func() error {
		var err error
		healthMetrics, err = h.store.GetHealthMetrics(gctx, dbID, 60)
		return err
	})
	g.Go(func() error {
		var err error
		customerIntel, err = h.store.GetCustomerIntelligence(gctx, dbID, 5)
		return err
	})
	g.Go(func() error {
		var err error
		dailyProto, err = h.store.GetDailyProtocolStats(gctx, dbID, days)
		return err
	})
	g.Go(func() error {
		var err error
		agentStats, err = h.store.GetAgentStats(gctx, dbID)
		return err
	})
	g.Go(func() error {
		var err error
		mcpTools, err = h.store.GetMCPToolBreakdown(gctx, dbID, days, 15)
		return err
	})
	g.Go(func() error {
		var err error
		a2aPartners, err = h.store.GetA2APartnerBreakdown(gctx, dbID, days, 10)
		return err
	})
	g.Go(func() error {
		var err error
		a2aEndpoints, err = h.store.GetA2AEndpointStats(gctx, dbID, days, 10)
		return err
	})

	if err := g.Wait(); err != nil {
		h.logger.Error("analytics report failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate analytics"})
		return
	}

	revSummary := &AnalyticsRevenueSummary{}
	if agentStats != nil {
		revSummary.TotalRevenue = agentStats.TotalRevenueUSDC
		revSummary.PaymentCount = agentStats.PaidCount
		if agentStats.TotalRequests > 0 {
			revSummary.AvgPerRequest = agentStats.TotalRevenueUSDC / float64(agentStats.TotalRequests)
		}
	}
	if customerIntel != nil && customerIntel.TotalCustomers > 0 {
		revSummary.ARPU = revSummary.TotalRevenue / float64(customerIntel.TotalCustomers)
	}
	if healthMetrics != nil {
		revSummary.RequiredCount = healthMetrics.PaymentCount
		total := revSummary.RequiredCount + revSummary.PaymentCount
		if total > 0 {
			revSummary.ConversionRate = float64(revSummary.PaymentCount) / float64(total)
		}
	}

	report := AnalyticsReportResponse{
		Protocol:     protocolStats,
		ToolRanking:  toolUsage,
		Health:       healthMetrics,
		Customers:    customerIntel,
		Revenue:      revSummary,
		DailyByProto: dailyProto,
		MCPTools:     mcpTools,
		A2APartners:  a2aPartners,
		A2AEndpoints: a2aEndpoints,
	}

	data, _ := json.Marshal(report)
	h.cache.Set(ctx, cacheKey, data, 15*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}

// ConversionFunnel handles GET /v1/agents/:agent_id/funnel?days=30
func (h *Handler) ConversionFunnel(c *gin.Context) {
	dbID, ok := h.resolveOwnedAgent(c)
	if !ok {
		return
	}

	days := 30
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 90 {
			days = v
		}
	}

	cacheKey := fmt.Sprintf("agent:%s:funnel:%d", c.Param("agent_id"), days)
	if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	ctx := c.Request.Context()
	g, gctx := errgroup.WithContext(ctx)

	var summary *store.FunnelSummary
	var dailyTrend []store.DailyFunnelStats
	var journeys []store.CustomerJourney

	g.Go(func() error {
		var err error
		summary, err = h.store.GetFunnelSummary(gctx, dbID, days)
		return err
	})
	g.Go(func() error {
		var err error
		dailyTrend, err = h.store.GetDailyFunnelStats(gctx, dbID, days)
		return err
	})
	g.Go(func() error {
		var err error
		journeys, err = h.store.GetCustomerJourneys(gctx, dbID, days, 20)
		return err
	})

	if err := g.Wait(); err != nil {
		h.logger.Error("funnel report failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate funnel report"})
		return
	}

	report := store.FunnelReport{
		Summary:    summary,
		DailyTrend: dailyTrend,
		Journeys:   journeys,
	}

	data, _ := json.Marshal(report)
	h.cache.Set(ctx, cacheKey, data, 30*time.Second)
	c.Data(http.StatusOK, "application/json", data)
}
