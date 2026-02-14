locals {
  registry_path = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
  database_url  = "postgres://gt8004:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/gt8004?sslmode=disable"
}

# ── Registry ──────────────────────────────────────────
resource "google_cloud_run_v2_service" "registry" {
  name     = "gt8004-registry"
  location = var.region

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.registry_path}/registry:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "ADMIN_API_KEY"
        value = var.admin_api_key
      }
      env {
        name  = "IDENTITY_REGISTRY_ADDRESS"
        value = var.identity_registry_address
      }
      env {
        name  = "IDENTITY_REGISTRY_RPC"
        value = var.identity_registry_rpc
      }
    }
  }

  depends_on = [
    google_sql_database.gt8004,
    google_sql_user.gt8004,
  ]
}

# ── Analytics ─────────────────────────────────────────
resource "google_cloud_run_v2_service" "analytics" {
  name     = "gt8004-analytics"
  location = var.region

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.registry_path}/analytics:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "ADMIN_API_KEY"
        value = var.admin_api_key
      }
    }
  }

  depends_on = [
    google_sql_database.gt8004,
    google_sql_user.gt8004,
  ]
}

# ── Discovery ─────────────────────────────────────────
resource "google_cloud_run_v2_service" "discovery" {
  name     = "gt8004-discovery"
  location = var.region

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.registry_path}/discovery:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 30
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "SCAN_SYNC_INTERVAL"
        value = tostring(var.scan_sync_interval)
      }
    }
  }

  depends_on = [
    google_sql_database.gt8004,
    google_sql_user.gt8004,
  ]
}

# ── Ingest (독립 서비스 — ingest.gt8004.xyz) ──────────
resource "google_cloud_run_v2_service" "ingest" {
  name     = "gt8004-ingest"
  location = var.region

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.registry_path}/ingest:latest"

      ports {
        container_port = 9094
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 9094
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 9094
        }
        period_seconds = 30
      }

      env {
        name  = "PORT"
        value = "9094"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "INGEST_WORKERS"
        value = tostring(var.ingest_workers)
      }
      env {
        name  = "INGEST_BUFFER_SIZE"
        value = "1000"
      }
      env {
        name  = "MAX_BODY_SIZE_BYTES"
        value = "51200"
      }
      env {
        name  = "RATE_LIMIT"
        value = tostring(var.ingest_rate_limit)
      }
      env {
        name  = "RATE_BURST"
        value = tostring(var.ingest_rate_burst)
      }
    }
  }

  depends_on = [
    google_sql_database.gt8004,
    google_sql_user.gt8004,
  ]
}

# ── API Gateway ───────────────────────────────────────
# NOTE: apigateway에 INGEST_URL 없음 — ingest는 독립 서비스
resource "google_cloud_run_v2_service" "apigateway" {
  name     = "gt8004-apigateway"
  location = var.region

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.registry_path}/apigateway:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 3
        period_seconds        = 5
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds = 30
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "ANALYTICS_URL"
        value = google_cloud_run_v2_service.analytics.uri
      }
      env {
        name  = "DISCOVERY_URL"
        value = google_cloud_run_v2_service.discovery.uri
      }
      env {
        name  = "REGISTRY_URL"
        value = google_cloud_run_v2_service.registry.uri
      }
    }
  }
}

# ── Public Access (allow-unauthenticated) ─────────────
resource "google_cloud_run_v2_service_iam_member" "apigateway_public" {
  name     = google_cloud_run_v2_service.apigateway.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "ingest_public" {
  name     = google_cloud_run_v2_service.ingest.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "registry_public" {
  name     = google_cloud_run_v2_service.registry.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "analytics_public" {
  name     = google_cloud_run_v2_service.analytics.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "discovery_public" {
  name     = google_cloud_run_v2_service.discovery.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
