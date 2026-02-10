package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"

	"github.com/GT8004/gt8004-analytics/internal/store"
)

// TrustScore handles GET /v1/agents/:agent_id/trust
func (h *Handler) TrustScore(c *gin.Context) {
	dbID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	cacheKey := fmt.Sprintf("agent:%s:trust", c.Param("agent_id"))
	if h.cache != nil {
		if cached := h.cache.Get(c.Request.Context(), cacheKey); cached != nil {
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
	}

	ctx := c.Request.Context()
	g, gctx := errgroup.WithContext(ctx)

	var breakdown *store.ReputationBreakdown
	var reviews []store.AgentReview
	var reviewTotal int

	g.Go(func() error {
		var err error
		breakdown, err = h.store.GetReputationBreakdown(gctx, dbID)
		if err != nil {
			return nil // non-fatal: may not exist yet
		}
		return nil
	})
	g.Go(func() error {
		var err error
		reviews, reviewTotal, err = h.store.GetAgentReviews(gctx, dbID, 10, 0)
		if err != nil {
			return nil // non-fatal
		}
		return nil
	})

	_ = g.Wait()

	if breakdown == nil {
		breakdown = &store.ReputationBreakdown{}
	}
	if reviews == nil {
		reviews = []store.AgentReview{}
	}

	resp := gin.H{
		"score":        breakdown.TotalScore,
		"breakdown":    breakdown,
		"reviews":      reviews,
		"review_total": reviewTotal,
	}

	data, _ := json.Marshal(resp)
	if h.cache != nil {
		h.cache.Set(ctx, cacheKey, data, 15*time.Second)
	}
	c.Data(http.StatusOK, "application/json", data)
}

// SubmitReviewRequest is the request body for POST /v1/agents/:agent_id/reviews.
type SubmitReviewRequest struct {
	ReviewerID string   `json:"reviewer_id" binding:"required"`
	Score      int      `json:"score" binding:"required,min=1,max=5"`
	Tags       []string `json:"tags"`
	Comment    string   `json:"comment"`
}

// SubmitReview handles POST /v1/agents/:agent_id/reviews
func (h *Handler) SubmitReview(c *gin.Context) {
	dbID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	var req SubmitReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Prevent self-review
	agent, err := h.store.GetAgentByDBID(c.Request.Context(), dbID)
	if err != nil {
		h.logger.Error("failed to get agent for review", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if agent.AgentID == req.ReviewerID || strings.EqualFold(agent.EVMAddress, req.ReviewerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot review yourself"})
		return
	}

	if req.Tags == nil {
		req.Tags = []string{}
	}

	review := &store.AgentReview{
		AgentID:    dbID,
		ReviewerID: req.ReviewerID,
		Score:      req.Score,
		Tags:       req.Tags,
		Comment:    req.Comment,
	}

	if err := h.store.InsertAgentReview(c.Request.Context(), review); err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "dedup") {
			c.JSON(http.StatusConflict, gin.H{"error": "already reviewed today"})
			return
		}
		h.logger.Error("failed to insert review", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit review"})
		return
	}

	// Invalidate trust cache
	if h.cache != nil {
		h.cache.Del(c.Request.Context(), fmt.Sprintf("agent:%s:trust", c.Param("agent_id")))
	}

	c.JSON(http.StatusCreated, gin.H{"status": "review submitted", "review": review})
}

// ListReviews handles GET /v1/agents/:agent_id/reviews
func (h *Handler) ListReviews(c *gin.Context) {
	dbID, ok := h.resolvePublicAgent(c)
	if !ok {
		return
	}

	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if l, err := strconv.Atoi(raw); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	offset := 0
	if raw := c.Query("offset"); raw != "" {
		if o, err := strconv.Atoi(raw); err == nil && o >= 0 {
			offset = o
		}
	}

	reviews, total, err := h.store.GetAgentReviews(c.Request.Context(), dbID, limit, offset)
	if err != nil {
		h.logger.Error("failed to list reviews", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list reviews"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"reviews": reviews,
		"total":   total,
	})
}
