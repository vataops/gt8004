# GT8004 (Gate 8004)

## Core Principle

**No service should call or depend on another service's API.**
Even if it requires extra effort, each service must fetch the data it needs directly from on-chain sources (ERC-8004 registry, smart contracts).
The design principle of this project is to eliminate inter-service coupling and keep the blockchain as the single source of truth.
