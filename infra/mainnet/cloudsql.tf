# ── Cloud SQL Instance (mainnet) ───────────────────────
# Uses the shared VPC for private networking.
# Private service connection is already established.

data "google_compute_network" "shared" {
  name    = "gt8004-testnet-vpc"
  project = var.project_id
}

resource "google_sql_database_instance" "main" {
  name             = "gt8004"
  database_version = "POSTGRES_16"
  region           = var.region

  deletion_protection = true

  settings {
    tier              = "db-f1-micro"
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = data.google_compute_network.shared.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }
  }
}

# ── Database ───────────────────────────────────────────
resource "google_sql_database" "gt8004" {
  name     = "gt8004_new"
  instance = google_sql_database_instance.main.name
}

# ── User ───────────────────────────────────────────────
resource "google_sql_user" "gt8004" {
  name     = "gt8004"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
