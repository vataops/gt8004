package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) Healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// AgentHealth returns 200 if the agent exists and is active.
func (h *Handler) AgentHealth(c *gin.Context) {
	agentID := c.Param("agent_id")
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id required"})
		return
	}
	agent, err := h.store.GetAgentByID(c.Request.Context(), agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "not_found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"agent_id": agent.AgentID,
		"gateway":  agent.GatewayEnabled,
	})
}

// AgentOriginHealth proxies a health check to the agent's origin endpoint
// (server-side, avoiding browser CORS restrictions).
func (h *Handler) AgentOriginHealth(c *gin.Context) {
	agentID := c.Param("agent_id")
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id required"})
		return
	}
	agent, err := h.store.GetAgentByID(c.Request.Context(), agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "not_found"})
		return
	}
	if agent.OriginEndpoint == "" {
		c.JSON(http.StatusOK, gin.H{"status": "no_endpoint"})
		return
	}

	endpoint := strings.TrimRight(agent.OriginEndpoint, "/")
	healthURL := fmt.Sprintf("%s/.well-known/agent.json", endpoint)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(healthURL)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": agent.OriginEndpoint})
	} else {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "http_status": resp.StatusCode})
	}
}

// ServiceHealth proxies a health check to an arbitrary service endpoint
// (server-side, avoiding browser CORS restrictions).
// Query param: ?endpoint=<base_url>
func (h *Handler) ServiceHealth(c *gin.Context) {
	endpoint := c.Query("endpoint")
	if endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint query parameter required"})
		return
	}

	// Only allow http/https
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint must be http or https"})
		return
	}

	base := strings.TrimRight(endpoint, "/")
	healthURL := fmt.Sprintf("%s/.well-known/agent.json", base)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(healthURL)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": endpoint})
	} else {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "http_status": resp.StatusCode})
	}
}

func (h *Handler) Readyz(c *gin.Context) {
	if err := h.store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not ready"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}
