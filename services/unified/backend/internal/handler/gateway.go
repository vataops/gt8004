package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/ingest"
)

// EnableGateway handles POST /v1/agents/:agent_id/gateway/enable
func (h *Handler) EnableGateway(c *gin.Context) {
	dbID, ok := h.resolveViewableAgent(c)
	if !ok {
		return
	}

	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, true); err != nil {
		h.logger.Error("failed to enable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable gateway"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"gateway_enabled": true})
}

// DisableGateway handles POST /v1/agents/:agent_id/gateway/disable
func (h *Handler) DisableGateway(c *gin.Context) {
	dbID, ok := h.resolveViewableAgent(c)
	if !ok {
		return
	}

	if err := h.store.SetGatewayEnabled(c.Request.Context(), dbID, false); err != nil {
		h.logger.Error("failed to disable gateway", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable gateway"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"gateway_enabled": false})
}

// GatewayProxy handles ANY /gateway/:slug/*path -- proxies to agent's origin.
func (h *Handler) GatewayProxy(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Param("path")
	if path == "" {
		path = "/"
	}
	// Remove leading slash duplication
	path = "/" + strings.TrimLeft(path, "/")

	agent, err := h.store.GetAgentByID(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	if !agent.GatewayEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "gateway not enabled for this agent"})
		return
	}

	if h.rateLimiter != nil && !h.rateLimiter.Allow(slug) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
		return
	}

	result := h.proxy.Forward(c.Writer, c.Request, agent, path)

	// Auto-log the proxied request
	statusCode := result.StatusCode
	if result.Error != nil && statusCode == 0 {
		statusCode = http.StatusBadGateway
	}

	entry := ingest.LogEntry{
		RequestID:  uuid.New().String(),
		Method:     c.Request.Method,
		Path:       path,
		StatusCode: statusCode,
		ResponseMs: float32(result.ResponseMs),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	// Extract caller agent ID as customer
	if callerID := c.GetHeader("X-Agent-ID"); callerID != "" {
		entry.CustomerID = &callerID
	}

	// Extract x402 payment info from X-Payment header
	if paymentHeader := c.GetHeader("X-Payment"); paymentHeader != "" {
		var payment struct {
			Amount float64 `json:"amount"`
			TxHash string  `json:"tx_hash"`
			Token  string  `json:"token"`
			Payer  string  `json:"payer"`
		}
		if err := json.Unmarshal([]byte(paymentHeader), &payment); err == nil {
			if payment.Amount > 0 {
				entry.X402Amount = &payment.Amount
			}
			if payment.TxHash != "" {
				entry.X402TxHash = &payment.TxHash
			}
			if payment.Token != "" {
				entry.X402Token = &payment.Token
			}
			if payment.Payer != "" {
				entry.X402Payer = &payment.Payer
			}
		}
	}

	// Extract tool name from path (last segment)
	if segments := strings.Split(strings.Trim(path, "/"), "/"); len(segments) > 0 {
		toolName := segments[len(segments)-1]
		if toolName != "" {
			entry.ToolName = &toolName
		}
	}

	batch := &ingest.LogBatch{
		AgentID:    agent.AgentID,
		SDKVersion: "gateway-1.0",
		BatchID:    uuid.New().String(),
		Entries:    []ingest.LogEntry{entry},
	}

	h.worker.Submit(&ingest.IngestJob{
		AgentDBID: agent.ID,
		Batch:     batch,
	})
}
