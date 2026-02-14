# ── Cloud SQL Instance ─────────────────────────────────
resource "google_sql_database_instance" "main" {
  name             = "gt8004-testnet"
  database_version = "POSTGRES_16"
  region           = var.region

  deletion_protection = false

  settings {
    tier              = "db-f1-micro"
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled = false
    }
  }

  depends_on = [google_service_networking_connection.private]
}

# ── Database ───────────────────────────────────────────
resource "google_sql_database" "gt8004" {
  name     = "gt8004"
  instance = google_sql_database_instance.main.name
}

# ── User ───────────────────────────────────────────────
resource "google_sql_user" "gt8004" {
  name     = "gt8004"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
