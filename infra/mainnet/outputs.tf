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
  description = "Ingest Cloud Run URL"
  value       = google_cloud_run_v2_service.ingest.uri
}

output "artifact_registry" {
  description = "Artifact Registry repository path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
