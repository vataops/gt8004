# ── VPC Network ────────────────────────────────────────
resource "google_compute_network" "main" {
  name                    = "gt8004-testnet-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "main" {
  name          = "gt8004-testnet-subnet"
  ip_cidr_range = "10.8.0.0/28"
  region        = var.region
  network       = google_compute_network.main.id
}

# ── Private Services Access (Cloud SQL) ────────────────
resource "google_compute_global_address" "private_ip" {
  name          = "gt8004-testnet-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]

  depends_on = [google_project_service.apis]
}

# ── Serverless VPC Connector (Cloud Run → Cloud SQL) ───
resource "google_vpc_access_connector" "main" {
  name          = "gt8004-testnet-vpc"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.1.0/28"
  machine_type  = "e2-micro"
  min_instances = 2
  max_instances = 3

  depends_on = [google_project_service.apis]
}
