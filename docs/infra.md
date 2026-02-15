# GT8004 Infrastructure

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 개요

GT8004는 GCP (Google Cloud Platform)에 배포된다. Terraform으로 인프라를 관리하며, Cloud Run + Cloud SQL + VPC 기반 아키텍처를 사용한다.

```
┌─────────────────────────────────────────────────────┐
│ GCP Project                                         │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Artifact Registry (gt8004-testnet)            │   │
│  │  - apigateway, registry, analytics,           │   │
│  │    discovery, ingest Docker 이미지             │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Cloud Run                                     │   │
│  │  apigateway → registry / analytics / discovery│   │
│  │  ingest (독립, :9094)                          │   │
│  └────────────┬─────────────────────────────────┘   │
│               │ VPC Connector                        │
│  ┌────────────▼─────────────────────────────────┐   │
│  │ VPC (gt8004-testnet-vpc)                      │   │
│  │  Subnet: 10.8.0.0/28                         │   │
│  │  VPC Connector: 10.8.1.0/28                   │   │
│  └────────────┬─────────────────────────────────┘   │
│               │ Private IP                           │
│  ┌────────────▼─────────────────────────────────┐   │
│  │ Cloud SQL (PostgreSQL 16)                     │   │
│  │  gt8004-testnet / db-f1-micro / 10GB SSD     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Terraform 리소스

### Cloud Run 서비스

| 서비스 | 이미지 | 포트 | CPU | 메모리 | 스케일링 | 헬스 체크 |
|--------|--------|------|-----|--------|---------|----------|
| gt8004-registry | registry:latest | 8080 | 1 | 512Mi | 0-2 | /healthz |
| gt8004-analytics | analytics:latest | 8080 | 1 | 512Mi | 0-2 | /healthz |
| gt8004-discovery | discovery:latest | 8080 | 1 | 256Mi | 0-2 | /healthz |
| gt8004-ingest | ingest:latest | 9094 | 1 | 256Mi | 0-2 | /healthz |
| gt8004-apigateway | apigateway:latest | 8080 | 1 | 256Mi | 0-2 | /health |

**공통 설정:**
- VPC: PRIVATE_RANGES_ONLY (Serverless VPC Connector 경유)
- 서비스 계정: gt8004-testnet-runner
- 접근 제어: allUsers (unauthenticated invocation 허용)
- Startup probe: 5초 초기 지연, 5초 주기, 10회 실패 허용
- Liveness probe: 30초 주기 (apigateway는 5초)

**서비스별 환경 변수:**

#### Registry
| 변수 | 값 |
|------|-----|
| PORT | 8080 |
| LOG_LEVEL | info |
| DATABASE_URL | postgres://gt8004:{password}@{db_private_ip}:5432/gt8004?sslmode=disable |
| IDENTITY_REGISTRY_ADDRESS | var.identity_registry_address |
| IDENTITY_REGISTRY_RPC | var.identity_registry_rpc |
| GT8004_TOKEN_ID | var.gt8004_token_id |
| GT8004_AGENT_URI | var.gt8004_agent_uri |

#### Analytics
| 변수 | 값 |
|------|-----|
| PORT | 8080 |
| LOG_LEVEL | info |
| DATABASE_URL | (동일) |

#### Discovery
| 변수 | 값 |
|------|-----|
| PORT | 8080 |
| LOG_LEVEL | info |
| DATABASE_URL | (동일) |
| SCAN_SYNC_INTERVAL | var.scan_sync_interval |

#### Ingest
| 변수 | 값 |
|------|-----|
| PORT | 9094 |
| LOG_LEVEL | info |
| DATABASE_URL | (동일) |
| INGEST_WORKERS | var.ingest_workers |
| INGEST_BUFFER_SIZE | 1000 |
| MAX_BODY_SIZE_BYTES | 51200 |
| RATE_LIMIT | var.ingest_rate_limit |
| RATE_BURST | var.ingest_rate_burst |

#### API Gateway
| 변수 | 값 |
|------|-----|
| PORT | 8080 |
| LOG_LEVEL | info |
| ANALYTICS_URL | analytics Cloud Run URI |
| DISCOVERY_URL | discovery Cloud Run URI |
| REGISTRY_URL | registry Cloud Run URI |

---

### Cloud SQL

| 설정 | 값 |
|------|-----|
| 인스턴스명 | gt8004-testnet |
| 엔진 | PostgreSQL 16 |
| 에디션 | ENTERPRISE |
| 티어 | db-f1-micro |
| 가용성 | ZONAL |
| 디스크 | 10 GB SSD (PD_SSD) |
| IPv4 | 비활성화 |
| Private IP | 활성화 (VPC 피어링) |
| 백업 | 비활성화 |
| 삭제 방지 | 비활성화 |
| DB명 | gt8004 |
| 사용자 | gt8004 |

---

### VPC / 네트워크

| 리소스 | 설정 |
|--------|------|
| VPC | gt8004-testnet-vpc (auto-create 비활성화) |
| Subnet | gt8004-testnet-subnet (10.8.0.0/28) |
| Private IP | gt8004-testnet-private-ip (/16, VPC_PEERING) |
| Service Networking | servicenetworking.googleapis.com 연결 |
| VPC Connector | gt8004-testnet-vpc (10.8.1.0/28, e2-micro, 2-3 인스턴스) |

---

### IAM

**서비스 계정:** gt8004-testnet-runner

| IAM 역할 | 설명 |
|----------|------|
| roles/cloudsql.client | Cloud SQL 연결 |
| roles/artifactregistry.reader | 컨테이너 이미지 풀 |
| roles/logging.logWriter | Cloud Logging 기록 |

---

### Artifact Registry

| 설정 | 값 |
|------|-----|
| 리포지토리 ID | gt8004-testnet |
| 위치 | var.region |
| 포맷 | DOCKER |
| 정리 정책 | 최근 5개 버전 유지 |

**레지스트리 경로:** `{region}-docker.pkg.dev/{project_id}/gt8004-testnet`

---

## 환경 변수

`infra/testnet/terraform.tfvars.example` 기반:

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `project_id` | string | (필수) | GCP 프로젝트 ID |
| `region` | string | us-central1 | GCP 리전 |
| `db_password` | string (sensitive) | (필수) | Cloud SQL 비밀번호 |
| `identity_registry_address` | string | 0x8004A818BFB912233c491871b3d84c89A494BD9e | Identity Registry 주소 |
| `identity_registry_rpc` | string | https://base-sepolia-rpc.publicnode.com | RPC 엔드포인트 |
| `scan_sync_interval` | number | 300 | Discovery 동기화 주기 (초) |
| `ingest_workers` | number | 4 | Ingest 워커 수 |
| `ingest_rate_limit` | number | 10 | 레이트 리밋 (req/s) |
| `ingest_rate_burst` | number | 100 | 레이트 버스트 |
| `gt8004_token_id` | number | 0 | ERC-8004 토큰 ID |
| `gt8004_agent_uri` | string | https://api.gt8004.xyz | 에이전트 URI |

---

## Terraform Outputs

| Output | 설명 |
|--------|------|
| `apigateway_url` | API Gateway Cloud Run URL |
| `registry_url` | Registry Cloud Run URL |
| `analytics_url` | Analytics Cloud Run URL |
| `discovery_url` | Discovery Cloud Run URL |
| `ingest_url` | Ingest Cloud Run URL |
| `db_connection_name` | Cloud SQL 연결 이름 |
| `db_private_ip` | Cloud SQL Private IP |
| `artifact_registry` | Artifact Registry 경로 |

---

## 활성화된 GCP API

- compute.googleapis.com
- sqladmin.googleapis.com
- run.googleapis.com
- artifactregistry.googleapis.com
- cloudbuild.googleapis.com
- servicenetworking.googleapis.com
- vpcaccess.googleapis.com

---

## 배포 방법

### 1. Docker 이미지 빌드 & 푸시

```bash
# scripts/build-push-testnet.sh
bash scripts/build-push-testnet.sh [TAG]

# 예시
bash scripts/build-push-testnet.sh v1.0.0
```

**환경 변수:**
- `GCP_PROJECT_ID` — GCP 프로젝트 ID (기본: vataops)
- `GCP_REGION` — GCP 리전 (기본: us-central1)

**빌드 대상:**
1. apigateway (`services/apigateway/Dockerfile`)
2. registry (`services/registry/backend/Dockerfile`)
3. analytics (`services/analytics/Dockerfile`)
4. discovery (`services/discovery/Dockerfile`)
5. ingest (`services/ingest/Dockerfile`)

### 2. Terraform 배포

```bash
cd infra/testnet
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars 편집 (project_id, db_password 등)
terraform init
terraform plan
terraform apply
```
