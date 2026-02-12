package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/GT8004/gt8004-ingest/internal/ingest"
)

// GatewayProxy handles ANY /gateway/:slug/*path -- proxies to agent's origin
// and automatically logs the request via the ingest worker.
func (h *Handler) GatewayProxy(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Param("path")
	if path == "" {
		path = "/"
	}
	path = "/" + strings.TrimLeft(path, "/")

	// Fetch agent from DB directly (no inter-service call)
	agent, err := h.store.GetAgentBySlug(c.Request.Context(), slug)
	if err != nil {
		h.logger.Debug("agent lookup failed", zap.String("slug", slug), zap.Error(err))
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

	result := h.proxy.Forward(c.Writer, c.Request, agent.OriginEndpoint, path)

	// Auto-log the proxied request
	statusCode := result.StatusCode
	if result.Error != nil && statusCode == 0 {
		statusCode = http.StatusBadGateway
	}

	protocol := detectProtocol(path)
	gatewaySource := "gateway"
	entry := ingest.LogEntry{
		RequestID:  uuid.New().String(),
		Method:     c.Request.Method,
		Path:       path,
		StatusCode: statusCode,
		ResponseMs: float32(result.ResponseMs),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Protocol:   &protocol,
		Source:     &gatewaySource,
	}

	// Extract x402 payment info
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

	// Extract tool name from path
	if segments := strings.Split(strings.Trim(path, "/"), "/"); len(segments) > 0 {
		toolName := segments[len(segments)-1]
		if toolName != "" {
			entry.ToolName = &toolName
		}
	}

	// Capture request/response body
	if result.RequestBody != "" {
		entry.RequestBody = &result.RequestBody
		reqSize := len(result.RequestBody)
		entry.RequestBodySize = &reqSize
	}
	if result.ResponseBody != "" {
		entry.ResponseBody = &result.ResponseBody
		respSize := len(result.ResponseBody)
		entry.ResponseBodySize = &respSize
	}

	// Capture headers
	if len(result.RequestHeaders) > 0 {
		headersJSON, _ := json.Marshal(result.RequestHeaders)
		raw := json.RawMessage(headersJSON)
		entry.Headers = &raw
	}

	// Capture client metadata
	if ip := clientIP(c); ip != "" {
		entry.IPAddress = &ip
	}
	if ua := c.GetHeader("User-Agent"); ua != "" {
		entry.UserAgent = &ua
	}
	if ref := c.GetHeader("Referer"); ref != "" {
		entry.Referer = &ref
	}
	if ct := c.GetHeader("Content-Type"); ct != "" {
		entry.ContentType = &ct
	}
	if al := c.GetHeader("Accept-Language"); al != "" {
		entry.AcceptLanguage = &al
	}

	batch := &ingest.LogBatch{
		AgentID:    agent.AgentID,
		SDKVersion: "gateway-1.0",
		BatchID:    uuid.New().String(),
		Entries:    []ingest.LogEntry{entry},
	}

	h.worker.Submit(&ingest.IngestJob{
		AgentDBID: agent.ID,
		AgentID:   agent.AgentID,
		Batch:     batch,
	})
}

func clientIP(c *gin.Context) string {
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		if idx := strings.IndexByte(xff, ','); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return xri
	}
	return c.ClientIP()
}

func detectProtocol(path string) string {
	lp := strings.ToLower(path)
	if strings.Contains(lp, "/mcp/") || strings.HasSuffix(lp, "/mcp") {
		return "mcp"
	}
	if strings.Contains(lp, "/a2a/") || strings.HasSuffix(lp, "/a2a") ||
		strings.Contains(lp, "/.well-known/") {
		return "a2a"
	}
	return "http"
}
