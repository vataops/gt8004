package types

import "time"

// Agent represents a registered agent shared across tiers.
type Agent struct {
	ID              string     `json:"id"`
	AgentID         string     `json:"agent_id"`
	EVMAddress      string     `json:"evm_address,omitempty"`
	ReputationScore float64    `json:"reputation_score,omitempty"`
	VerifiedAt      *time.Time `json:"verified_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
