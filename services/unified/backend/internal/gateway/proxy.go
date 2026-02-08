package gateway

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"go.uber.org/zap"

	"github.com/GT8004/gt8004/internal/store"
)

// ProxyResult captures metrics from a proxied request.
type ProxyResult struct {
	StatusCode int
	ResponseMs float64
	Error      error
}

// Proxy provides reverse-proxy functionality for the GT8004 gateway.
type Proxy struct {
	store  *store.Store
	logger *zap.Logger
}

// NewProxy creates a new gateway Proxy.
func NewProxy(s *store.Store, logger *zap.Logger) *Proxy {
	return &Proxy{store: s, logger: logger}
}

// Forward proxies the request to the agent's origin endpoint and returns metrics.
func (p *Proxy) Forward(w http.ResponseWriter, r *http.Request, agent *store.Agent, path string) *ProxyResult {
	result := &ProxyResult{}

	target, err := url.Parse(agent.OriginEndpoint)
	if err != nil {
		p.logger.Error("invalid origin endpoint", zap.String("agent_id", agent.AgentID), zap.Error(err))
		http.Error(w, "invalid origin endpoint", http.StatusBadGateway)
		result.StatusCode = http.StatusBadGateway
		result.Error = err
		return result
	}

	start := time.Now()

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.URL.Path = path
			req.Host = target.Host
			req.Header.Set("X-Forwarded-By", "GT8004-Gateway")
			req.Header.Set("X-GT8004-Agent-ID", agent.AgentID)
		},
		Transport: &http.Transport{
			ResponseHeaderTimeout: 30 * time.Second,
		},
		ModifyResponse: func(resp *http.Response) error {
			result.StatusCode = resp.StatusCode
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			p.logger.Error("proxy error", zap.String("agent_id", agent.AgentID), zap.Error(err))
			http.Error(w, fmt.Sprintf("gateway error: %v", err), http.StatusBadGateway)
			result.StatusCode = http.StatusBadGateway
			result.Error = err
		},
	}

	proxy.ServeHTTP(w, r)
	result.ResponseMs = float64(time.Since(start).Milliseconds())

	return result
}
