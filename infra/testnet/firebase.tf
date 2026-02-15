# ── Firebase Hosting (CDN → Cloud Run dashboard) ──────

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_hosting_site" "dashboard" {
  provider = google-beta
  project  = var.project_id
  site_id  = "${var.project_id}-gt8004"

  depends_on = [google_firebase_project.default]
}
