# ── Artifact Registry ──────────────────────────────────
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "gt8004-mainnet"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  depends_on = [google_project_service.apis]
}
