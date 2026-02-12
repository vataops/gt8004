# GT8004 (Gate 8004)

## Core Principles

### 1. Service Independence
**No service should call or depend on another service's API.**
Even if it requires extra effort, each service must fetch the data it needs directly from on-chain sources (ERC-8004 registry, smart contracts).
The design principle of this project is to eliminate inter-service coupling and keep the blockchain as the single source of truth.

### 2. Metadata Source of Truth
**All agent metadata MUST come from on-chain contract metadata.**
- Agent names and token names must be read from ERC-8004 contract metadata
- The service MUST NOT allow users to set or override agent names separately
- A2A and MCP origin endpoints must also come from contract metadata
- The contract metadata is the single source of truth for all agent identity and configuration
