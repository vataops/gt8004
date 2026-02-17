package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// parseChainIDs extracts chain_ids query param (comma-separated) into a set.
func parseChainIDs(c *gin.Context) map[int]struct{} {
	raw := c.Query("chain_ids")
	if raw == "" {
		return nil
	}
	ids := make(map[int]struct{})
	for _, s := range strings.Split(raw, ",") {
		if v, err := strconv.Atoi(strings.TrimSpace(s)); err == nil && v > 0 {
			ids[v] = struct{}{}
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return ids
}

// WalletStats returns aggregated stats across all agents owned by wallet
func (h *Handler) WalletStats(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet address required"})
		return
	}

	chainFilter := parseChainIDs(c)

	// Get agent DB IDs for this wallet
	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address, chainFilter)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	// Query aggregated stats
	stats, err := h.store.GetWalletStats(c.Request.Context(), agentIDs)
	if err != nil {
		h.logger.Error("failed to get wallet stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// WalletDailyStats returns daily time-series aggregated across owned agents
func (h *Handler) WalletDailyStats(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet address required"})
		return
	}

	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 || days > 90 {
		days = 30
	}

	chainFilter := parseChainIDs(c)

	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address, chainFilter)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	stats, err := h.store.GetWalletDailyStats(c.Request.Context(), agentIDs, days)
	if err != nil {
		h.logger.Error("failed to get wallet daily stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch daily stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// WalletErrors returns error analysis across all owned agents
func (h *Handler) WalletErrors(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet address required"})
		return
	}

	chainFilter := parseChainIDs(c)

	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address, chainFilter)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	errors, err := h.store.GetWalletErrors(c.Request.Context(), agentIDs)
	if err != nil {
		h.logger.Error("failed to get wallet errors", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch errors"})
		return
	}

	c.JSON(http.StatusOK, errors)
}

// getWalletAgentIDs fetches agent DB IDs for a wallet address.
// When chainFilter is non-nil, only agents on those chain IDs are returned.
// Uses cache with 5-minute TTL to avoid repeated calls to registry service.
func (h *Handler) getWalletAgentIDs(ctx context.Context, address string, chainFilter map[int]struct{}) ([]uuid.UUID, error) {
	// Build cache key including chain filter for correctness
	cacheKey := "wallet_agents:" + address
	if chainFilter != nil {
		parts := make([]string, 0, len(chainFilter))
		for id := range chainFilter {
			parts = append(parts, strconv.Itoa(id))
		}
		cacheKey += ":chains=" + strings.Join(parts, ",")
	}

	if cached := h.cache.Get(ctx, cacheKey); cached != nil {
		var ids []uuid.UUID
		if err := json.Unmarshal(cached, &ids); err == nil {
			return ids, nil
		}
	}

	// Call registry service GET /v1/agents/wallet/:address
	registryURL := h.registryURL + "/v1/agents/wallet/" + address
	req, err := http.NewRequestWithContext(ctx, "GET", registryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call registry service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry service returned %d", resp.StatusCode)
	}

	var result struct {
		Agents []struct {
			ID      string `json:"id"`       // DB ID (UUID)
			ChainID int    `json:"chain_id"` // chain the agent is registered on
		} `json:"agents"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	// Extract UUIDs, filtering by chain_id when specified
	ids := make([]uuid.UUID, 0, len(result.Agents))
	for _, a := range result.Agents {
		if chainFilter != nil {
			if _, ok := chainFilter[a.ChainID]; !ok {
				continue
			}
		}
		id, err := uuid.Parse(a.ID)
		if err == nil {
			ids = append(ids, id)
		}
	}

	// Cache for 5 minutes
	if data, err := json.Marshal(ids); err == nil {
		h.cache.Set(ctx, cacheKey, data, 5*time.Minute)
	}

	return ids, nil
}
