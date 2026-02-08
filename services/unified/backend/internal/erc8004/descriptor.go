package erc8004

// BuildDescriptor returns the GT8004 agent registration file content for /.well-known/agent.json.
func (c *Client) BuildDescriptor() map[string]interface{} {
	tiers := map[string]interface{}{
		"open": map[string]interface{}{
			"price":    "free",
			"features": []string{"analytics", "dashboard", "discovery", "gateway", "alerts", "benchmarks"},
		},
		"lite": map[string]interface{}{
			"status": "coming_soon",
		},
		"pro": map[string]interface{}{
			"status": "coming_soon",
		},
	}

	return map[string]interface{}{
		"type":        "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
		"name":        "GT8004 - Gate 8004",
		"description": "Gate for ERC-8004 AI agent economy.",
		"services": []map[string]interface{}{
			{
				"name":     "A2A",
				"endpoint": c.gt8004AgentURI + "/v1",
				"version":  "1.0.0",
				"skills":   []string{"agent-registration", "analytics-dashboard", "log-ingestion", "agent-discovery", "gateway-proxy"},
				"domains":  []string{"business-intelligence", "agent-economy"},
			},
		},
		"x402Support": false,
		"active":      true,
		"registrations": []map[string]interface{}{
			{
				"agentId":       c.gt8004TokenID,
				"agentRegistry": c.registryAddr,
			},
		},
		"gt8004": map[string]interface{}{
			"tiers": tiers,
		},
	}
}
