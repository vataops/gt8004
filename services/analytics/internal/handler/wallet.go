package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

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
// Queries the shared agents table directly (same DB) instead of calling the
// registry service over HTTP, which avoids Cloud Run auth issues.
func (h *Handler) getWalletAgentIDs(ctx context.Context, address string, chainFilter map[int]struct{}) ([]uuid.UUID, error) {
	allIDs, chainIDs, err := h.store.GetAgentDBIDsByEVMAddress(ctx, address)
	if err != nil {
		return nil, fmt.Errorf("get wallet agents: %w", err)
	}

	if chainFilter == nil {
		return allIDs, nil
	}

	// Filter by chain_id
	ids := make([]uuid.UUID, 0, len(allIDs))
	for i, id := range allIDs {
		if _, ok := chainFilter[chainIDs[i]]; ok {
			ids = append(ids, id)
		}
	}
	return ids, nil
}
