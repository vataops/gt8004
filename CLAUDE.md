# GT8004 (Gate 8004)

## Core Principles

### 1. Service Independence
**No service should call external third-party APIs.**
Internal MSA inter-service communication (e.g. analytics → registry) is allowed and expected.
However, services must NOT depend on external services outside our infrastructure.
On-chain data (ERC-8004 registry, smart contracts) is the single source of truth for agent identity.

### 2. Metadata Source of Truth
**All agent metadata MUST come from on-chain contract metadata.**
- Agent names and token names must be read from ERC-8004 contract metadata
- The service MUST NOT allow users to set or override agent names separately
- A2A and MCP origin endpoints must also come from contract metadata
- The contract metadata is the single source of truth for all agent identity and configuration
