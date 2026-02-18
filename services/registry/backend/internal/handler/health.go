package handler

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// isPrivateIP checks whether an IP is in a private/reserved range.
func isPrivateIP(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16", // link-local / cloud metadata
		"100.64.0.0/10",  // CGN
		"0.0.0.0/8",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// validateExternalURL ensures the URL resolves to a public IP (SSRF protection).
func validateExternalURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	host := u.Hostname()
	ips, err := net.DefaultResolver.LookupIPAddr(context.Background(), host)
	if err != nil {
		return err
	}
	for _, ip := range ips {
		if isPrivateIP(ip.IP) {
			return &net.AddrError{Err: "private IP not allowed", Addr: host}
		}
	}
	return nil
}

// safeHTTPClient returns an HTTP client that refuses to connect to private IPs.
func safeHTTPClient() *http.Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, err
			}
			for _, ip := range ips {
				if isPrivateIP(ip.IP) {
					return nil, &net.AddrError{Err: "private IP not allowed", Addr: host}
				}
			}
			dialer := &net.Dialer{Timeout: 10 * time.Second}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
		},
	}
	return &http.Client{Timeout: 30 * time.Second, Transport: transport}
}

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

	if err := validateExternalURL(agent.OriginEndpoint); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "error": "endpoint resolves to a restricted address"})
		return
	}

	base := strings.TrimRight(agent.OriginEndpoint, "/")
	client := safeHTTPClient()

	// MCP protocol: check SSE endpoint connectivity
	if hasMCP(agent.Protocols) {
		if checkMCPSSE(c.Request.Context(), client, base) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": agent.OriginEndpoint, "protocol": "mcp"})
		} else {
			c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "error": "SSE endpoint unreachable"})
		}
		return
	}

	// Default: HTTP GET health check
	resp, err := client.Get(base)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "error": "endpoint unreachable"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": agent.OriginEndpoint})
	} else {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": agent.OriginEndpoint, "http_status": resp.StatusCode})
	}
}

// checkMCPSSE checks if an MCP server is alive. It tries SSE paths first
// (legacy MCP transport), then falls back to /health (Streamable HTTP transport).
func checkMCPSSE(ctx context.Context, client *http.Client, base string) bool {
	// 1. Try SSE transport paths.
	for _, path := range []string{"/sse", "/mcp/sse"} {
		req, err := http.NewRequestWithContext(ctx, "GET", base+path, nil)
		if err != nil {
			continue
		}
		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		resp.Body.Close()
		ct := resp.Header.Get("Content-Type")
		if resp.StatusCode == http.StatusOK && strings.Contains(ct, "text/event-stream") {
			return true
		}
	}

	// 2. Fallback: /health endpoint (Streamable HTTP MCP servers).
	req, err := http.NewRequestWithContext(ctx, "GET", base+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

// hasMCP checks if "mcp" is in the protocols list.
func hasMCP(protocols []string) bool {
	for _, p := range protocols {
		if strings.EqualFold(p, "mcp") {
			return true
		}
	}
	return false
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

	// SSRF protection: block private/reserved IPs
	if err := validateExternalURL(endpoint); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "endpoint resolves to a restricted address"})
		return
	}

	base := strings.TrimRight(endpoint, "/")
	client := safeHTTPClient()
	protocol := c.Query("protocol")

	// MCP protocol: check SSE endpoint
	if strings.EqualFold(protocol, "mcp") {
		if checkMCPSSE(c.Request.Context(), client, base) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": endpoint, "protocol": "mcp"})
		} else {
			c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "error": "SSE endpoint unreachable"})
		}
		return
	}

	// Try /health first for proper status check
	resp, err := client.Get(base + "/health")
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": endpoint})
			return
		}
		if resp.StatusCode != http.StatusNotFound {
			c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "http_status": resp.StatusCode})
			return
		}
	}

	// Fallback: /health missing or unreachable, check base URL reachability
	resp2, err2 := client.Get(base)
	if err2 != nil {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "error": "endpoint unreachable"})
		return
	}
	defer resp2.Body.Close()

	if resp2.StatusCode < 500 {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "endpoint": endpoint})
	} else {
		c.JSON(http.StatusOK, gin.H{"status": "unhealthy", "endpoint": endpoint, "http_status": resp2.StatusCode})
	}
}

func (h *Handler) Readyz(c *gin.Context) {
	if err := h.store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not ready"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}
