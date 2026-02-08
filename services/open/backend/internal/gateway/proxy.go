package gateway

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"go.uber.org/zap"

	"github.com/AEL/aes-open/internal/store"
)

// Proxy provides reverse-proxy functionality for the AES gateway.
type Proxy struct {
	store  *store.Store
	logger *zap.Logger
}

// NewProxy creates a new gateway Proxy.
func NewProxy(s *store.Store, logger *zap.Logger) *Proxy {
	return &Proxy{store: s, logger: logger}
}

// Forward proxies the request to the agent's origin endpoint.
func (p *Proxy) Forward(w http.ResponseWriter, r *http.Request, agent *store.Agent, path string) {
	target, err := url.Parse(agent.OriginEndpoint)
	if err != nil {
		p.logger.Error("invalid origin endpoint", zap.String("agent_id", agent.AgentID), zap.Error(err))
		http.Error(w, "invalid origin endpoint", http.StatusBadGateway)
		return
	}

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.URL.Path = path
			req.Host = target.Host
			req.Header.Set("X-Forwarded-By", "AES-Gateway")
			req.Header.Set("X-AES-Agent-ID", agent.AgentID)
		},
		Transport: &http.Transport{
			ResponseHeaderTimeout: 30 * time.Second,
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			p.logger.Error("proxy error", zap.String("agent_id", agent.AgentID), zap.Error(err))
			http.Error(w, fmt.Sprintf("gateway error: %v", err), http.StatusBadGateway)
		},
	}

	proxy.ServeHTTP(w, r)
}
