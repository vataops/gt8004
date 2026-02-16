# ── Custom Domain Mapping ─────────────────────────────
#
# 사전 조건: gcloud domains verify gt8004.xyz
# (Google Search Console에서 도메인 소유권 확인 필요 — 1회만)
#
# terraform apply 후 output의 DNS 레코드를 AWS Route 53에 추가할 것

# ── Cloud Run Domain Mapping (API, Ingest) ────────────

resource "google_cloud_run_domain_mapping" "apigateway" {
  name     = "api.gt8004.xyz"
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.apigateway.name
  }
}

resource "google_cloud_run_domain_mapping" "ingest" {
  name     = "ingest.gt8004.xyz"
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.ingest.name
  }
}

# ── Firebase Hosting Custom Domain (Dashboard) ────────

resource "google_firebase_hosting_custom_domain" "dashboard" {
  provider = google-beta
  project  = var.project_id
  site_id  = google_firebase_hosting_site.dashboard.site_id

  custom_domain = "gt8004.xyz"
}
