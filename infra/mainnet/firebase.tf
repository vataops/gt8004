# ── Firebase Hosting (CDN → Cloud Run dashboard) ──────
# google_firebase_project는 testnet에서 이미 생성됨 — 여기서는 site만 추가

resource "google_firebase_hosting_site" "dashboard" {
  provider = google-beta
  project  = var.project_id
  site_id  = "${var.project_id}-gt8004-mainnet"
}
