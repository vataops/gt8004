variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Cloud SQL gt8004 user password"
  type        = string
  sensitive   = true
}

variable "admin_api_key" {
  description = "Admin API key for registry and analytics"
  type        = string
  sensitive   = true
}

variable "identity_registry_address" {
  description = "ERC-8004 Identity Registry contract address"
  type        = string
  default     = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
}

variable "identity_registry_rpc" {
  description = "RPC endpoint for ERC-8004 identity registry"
  type        = string
  default     = "https://base-sepolia-rpc.publicnode.com"
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

variable "ingest_rate_limit" {
  description = "Ingest rate limit (requests/second per IP)"
  type        = number
  default     = 10
}

variable "ingest_rate_burst" {
  description = "Ingest rate limit burst size"
  type        = number
  default     = 100
}
