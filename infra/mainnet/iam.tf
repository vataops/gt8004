# ── Service Account ────────────────────────────────────
resource "google_service_account" "runner" {
  account_id   = "gt8004-mainnet-runner"
  display_name = "GT8004 Mainnet Cloud Run Runner"
}

# ── IAM Bindings ───────────────────────────────────────
resource "google_project_iam_member" "runner_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runner.email}"
}

resource "google_project_iam_member" "runner_ar" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.runner.email}"
}

resource "google_project_iam_member" "runner_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runner.email}"
}
