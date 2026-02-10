package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Agent is the subset of agent data needed by the Gateway.
type Agent struct {
	ID             uuid.UUID `json:"id"`
	AgentID        string    `json:"agent_id"`
	OriginEndpoint string    `json:"origin_endpoint"`
	GatewayEnabled bool      `json:"gateway_enabled"`
}

type cachedAgent struct {
	agent     *Agent
	expiresAt time.Time
}

// RegistryClient fetches agent info from the Registry service via HTTP.
type RegistryClient struct {
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger

	mu    sync.RWMutex
	cache map[string]*cachedAgent
}

const agentCacheTTL = 60 * time.Second

func NewRegistryClient(baseURL string, logger *zap.Logger) *RegistryClient {
	return &RegistryClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		logger: logger,
		cache:  make(map[string]*cachedAgent),
	}
}

// GetAgent fetches an agent by slug from the Registry, with local caching.
func (c *RegistryClient) GetAgent(ctx context.Context, slug string) (*Agent, error) {
	// Check cache
	c.mu.RLock()
	if cached, ok := c.cache[slug]; ok && time.Now().Before(cached.expiresAt) {
		c.mu.RUnlock()
		return cached.agent, nil
	}
	c.mu.RUnlock()

	// Fetch from Registry
	url := fmt.Sprintf("%s/internal/agents/%s", c.baseURL, slug)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("registry request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("agent not found: %s", slug)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var agent Agent
	if err := json.Unmarshal(body, &agent); err != nil {
		return nil, fmt.Errorf("parse agent response: %w", err)
	}

	// Update cache
	c.mu.Lock()
	c.cache[slug] = &cachedAgent{
		agent:     &agent,
		expiresAt: time.Now().Add(agentCacheTTL),
	}
	c.mu.Unlock()

	return &agent, nil
}
