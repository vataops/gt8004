package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WalletStats returns aggregated stats across all agents owned by wallet
func (h *Handler) WalletStats(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet address required"})
		return
	}

	// Get agent DB IDs for this wallet
	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	// Query aggregated stats
	stats, err := h.store.GetWalletStats(c.Request.Context(), agentIDs)
	if err != nil {
		h.logger.Error("failed to get wallet stats", "error", err)
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

	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	stats, err := h.store.GetWalletDailyStats(c.Request.Context(), agentIDs, days)
	if err != nil {
		h.logger.Error("failed to get wallet daily stats", "error", err)
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

	agentIDs, err := h.getWalletAgentIDs(c.Request.Context(), address)
	if err != nil {
		h.logger.Error("failed to fetch wallet agents", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch agents"})
		return
	}

	errors, err := h.store.GetWalletErrors(c.Request.Context(), agentIDs)
	if err != nil {
		h.logger.Error("failed to get wallet errors", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch errors"})
		return
	}

	c.JSON(http.StatusOK, errors)
}

// getWalletAgentIDs fetches agent DB IDs for a wallet address.
// Uses cache with 5-minute TTL to avoid repeated calls to registry service.
func (h *Handler) getWalletAgentIDs(ctx context.Context, address string) ([]uuid.UUID, error) {
	// Check cache first
	cacheKey := "wallet_agents:" + address
	if cached, found := h.cache.Get(cacheKey); found {
		if ids, ok := cached.([]uuid.UUID); ok {
			return ids, nil
		}
	}

	// Call registry service GET /v1/agents/wallet/:address
	registryURL := "http://registry:8080/v1/agents/wallet/" + address
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
			ID string `json:"id"` // DB ID (UUID)
		} `json:"agents"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	// Extract UUIDs
	ids := make([]uuid.UUID, 0, len(result.Agents))
	for _, a := range result.Agents {
		id, err := uuid.Parse(a.ID)
		if err == nil {
			ids = append(ids, id)
		}
	}

	// Cache for 5 minutes
	h.cache.Set(cacheKey, ids, 5*time.Minute)

	return ids, nil
}
