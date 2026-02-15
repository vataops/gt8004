output "apigateway_url" {
  description = "API Gateway Cloud Run URL"
  value       = google_cloud_run_v2_service.apigateway.uri
}

output "registry_url" {
  description = "Registry Cloud Run URL"
  value       = google_cloud_run_v2_service.registry.uri
}

output "analytics_url" {
  description = "Analytics Cloud Run URL"
  value       = google_cloud_run_v2_service.analytics.uri
}

output "discovery_url" {
  description = "Discovery Cloud Run URL"
  value       = google_cloud_run_v2_service.discovery.uri
}

output "ingest_url" {
  description = "Ingest Cloud Run URL (ingest.gt8004.xyz)"
  value       = google_cloud_run_v2_service.ingest.uri
}

output "dashboard_url" {
  description = "Dashboard Cloud Run URL"
  value       = google_cloud_run_v2_service.dashboard.uri
}

output "firebase_hosting_url" {
  description = "Firebase Hosting URL (public frontend)"
  value       = "https://${google_firebase_hosting_site.dashboard.site_id}.web.app"
}

output "db_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.main.private_ip_address
}

output "artifact_registry" {
  description = "Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

# ── Shared resources (used by mainnet) ─────────────────
output "database_url" {
  description = "Cloud SQL connection string (shared with mainnet)"
  value       = "postgres://gt8004:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/gt8004?sslmode=disable"
  sensitive   = true
}

output "vpc_connector_id" {
  description = "VPC connector ID (shared with mainnet)"
  value       = google_vpc_access_connector.main.id
}
