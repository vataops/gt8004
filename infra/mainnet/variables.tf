variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

# ── Database & Network ─────────────────────────────────
variable "db_password" {
  description = "Cloud SQL database password"
  type        = string
  sensitive   = true
}

variable "vpc_connector_id" {
  description = "VPC connector ID for Cloud SQL access"
  type        = string
}

# ── ERC-8004 ───────────────────────────────────────────
variable "identity_registry_address" {
  description = "ERC-8004 Identity Registry contract address"
  type        = string
  default     = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
}

variable "identity_registry_rpc" {
  description = "RPC endpoint for ERC-8004 identity registry"
  type        = string
  default     = "https://ethereum-rpc.publicnode.com"
}

variable "scan_sync_interval" {
  description = "Discovery service on-chain sync interval (seconds)"
  type        = number
  default     = 300
}

variable "ingest_workers" {
  description = "Number of ingest worker goroutines"
  type        = number
  default     = 4
}

variable "gt8004_token_id" {
  description = "ERC-8004 token ID for registry service"
  type        = number
  default     = 0
}

variable "gt8004_agent_uri" {
  description = "GT8004 agent URI (set to apigateway URL after first deploy)"
  type        = string
  default     = "https://api.gt8004.xyz"
}

# ── Security ──────────────────────────────────────────
variable "internal_secret" {
  description = "Shared secret for service-to-service internal API auth"
  type        = string
  sensitive   = true
}
