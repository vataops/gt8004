locals {
  registry_path = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
  database_url  = "postgres://gt8004:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/gt8004_new?sslmode=require"
}

# ── Registry ──────────────────────────────────────────
resource "google_cloud_run_v2_service" "registry" {
  name     = "mainnet-gt8004-registry"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = var.vpc_connector_id
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
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "NETWORK_MODE"
        value = "mainnet"
      }
      env {
        name  = "IDENTITY_REGISTRY_ADDRESS"
        value = var.identity_registry_address
      }
      env {
        name  = "IDENTITY_REGISTRY_RPC"
        value = var.identity_registry_rpc
      }
      env {
        name  = "GT8004_TOKEN_ID"
        value = tostring(var.gt8004_token_id)
      }
      env {
        name  = "GT8004_AGENT_URI"
        value = var.gt8004_agent_uri
      }
      env {
        name  = "INTERNAL_SECRET"
        value = var.internal_secret
      }
    }
  }

}

# ── Analytics ─────────────────────────────────────────
resource "google_cloud_run_v2_service" "analytics" {
  name     = "mainnet-gt8004-analytics"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = var.vpc_connector_id
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
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "NETWORK_MODE"
        value = "mainnet"
      }
      env {
        name  = "REGISTRY_URL"
        value = google_cloud_run_v2_service.registry.uri
      }
    }
  }

}

# ── Discovery ─────────────────────────────────────────
resource "google_cloud_run_v2_service" "discovery" {
  name     = "mainnet-gt8004-discovery"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }

    vpc_access {
      connector = var.vpc_connector_id
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
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "DATABASE_URL"
        value = local.database_url
      }
      env {
        name  = "NETWORK_MODE"
        value = "mainnet"
      }
      env {
        name  = "SCAN_SYNC_INTERVAL"
        value = tostring(var.scan_sync_interval)
      }
    }
  }

}

# ── Ingest (독립 서비스) ──────────────────────────────
resource "google_cloud_run_v2_service" "ingest" {
  name     = "mainnet-gt8004-ingest"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = var.vpc_connector_id
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
          memory = "512Mi"
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

}

# ── API Gateway ───────────────────────────────────────
# NOTE: VPC connector 없음 — DB 직접 접근 없이 다른 Cloud Run 서비스만 호출
#       VPC connector가 있으면 외부(브라우저/대시보드)에서 접근 불가
resource "google_cloud_run_v2_service" "apigateway" {
  name     = "mainnet-gt8004-apigateway"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 1
      max_instance_count = 2
    }

    containers {
      image = "${local.registry_path}/apigateway:latest"

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

# ── Dashboard (Next.js) ───────────────────────────────
resource "google_cloud_run_v2_service" "dashboard" {
  name                = "mainnet-gt8004-dashboard"
  location            = var.region
  deletion_protection = false

  template {
    service_account = google_service_account.runner.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = "${local.registry_path}/dashboard:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
        period_seconds = 30
      }

      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
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

# Internal services: only callable by the service account (via API Gateway)
# iam_binding is authoritative — removes allUsers and grants only the SA
resource "google_cloud_run_v2_service_iam_binding" "registry_internal" {
  name     = google_cloud_run_v2_service.registry.name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["serviceAccount:${google_service_account.runner.email}"]
}

resource "google_cloud_run_v2_service_iam_binding" "analytics_internal" {
  name     = google_cloud_run_v2_service.analytics.name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["serviceAccount:${google_service_account.runner.email}"]
}

resource "google_cloud_run_v2_service_iam_binding" "discovery_internal" {
  name     = google_cloud_run_v2_service.discovery.name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["serviceAccount:${google_service_account.runner.email}"]
}

resource "google_cloud_run_v2_service_iam_member" "dashboard_public" {
  name     = google_cloud_run_v2_service.dashboard.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
