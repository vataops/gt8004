package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/store"
)

// CreateReview handles POST /v1/agents/:agent_id/reviews
// Requires X-Wallet-Address header for reviewer identification.
func (h *Handler) CreateReview(c *gin.Context) {
	agentDBID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	reviewerAddr := strings.ToLower(c.GetHeader("X-Wallet-Address"))
	if reviewerAddr == "" || !strings.HasPrefix(reviewerAddr, "0x") || len(reviewerAddr) != 42 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid X-Wallet-Address header required"})
		return
	}

	var req struct {
		Score   int      `json:"score" binding:"required,min=1,max=5"`
		Tags    []string `json:"tags"`
		Comment string   `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Tags == nil {
		req.Tags = []string{}
	}

	// Limit comment length
	if len(req.Comment) > 1000 {
		req.Comment = req.Comment[:1000]
	}

	review := &store.AgentReview{
		AgentID:    agentDBID,
		ReviewerID: reviewerAddr,
		Score:      req.Score,
		Tags:       req.Tags,
		Comment:    req.Comment,
	}

	if err := h.store.InsertAgentReview(c.Request.Context(), review); err != nil {
		if strings.Contains(err.Error(), "idx_agent_reviews_dedup") {
			c.JSON(http.StatusConflict, gin.H{"error": "you have already reviewed this agent today"})
			return
		}
		h.logger.Error("failed to create review", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, review)
}

// ListReviews handles GET /v1/agents/:agent_id/reviews
func (h *Handler) ListReviews(c *gin.Context) {
	agentDBID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	limit := 20
	offset := 0
	if raw := c.Query("limit"); raw != "" {
		if l, err := strconv.Atoi(raw); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if raw := c.Query("offset"); raw != "" {
		if o, err := strconv.Atoi(raw); err == nil && o >= 0 {
			offset = o
		}
	}

	reviews, total, err := h.store.ListAgentReviews(c.Request.Context(), agentDBID, limit, offset)
	if err != nil {
		h.logger.Error("failed to list reviews", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list reviews"})
		return
	}

	// Get summary stats
	avg, count, _ := h.store.GetAgentReviewSummary(c.Request.Context(), agentDBID)

	c.JSON(http.StatusOK, gin.H{
		"reviews":   reviews,
		"total":     total,
		"avg_score": avg,
		"count":     count,
	})
}
