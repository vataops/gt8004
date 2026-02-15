---
allowed-tools: Read, Glob, Grep, Bash(go build:*), Bash(tree:*), Bash(ls:*), Write, Edit, Task
argument-hint: [target: services|dashboard|sdk|contracts|database|infra|agents|all]
description: 현재 코드를 기준으로 docs/ 디렉토리에 GT8004 아키텍처 문서를 자동 생성
---

## Context

- Project: GT8004 (Gate 8004) — ERC-8004 AI 에이전트 비즈니스 인텔리전스 플랫폼
- 마이크로서비스 구조: `services/` 하위에 5개 독립 Go 서비스
  - `services/registry/backend` — 에이전트 등록, 인증, 게이트웨이 (주 서비스)
  - `services/analytics` — 분석, GeoIP, 리텐션
  - `services/discovery` — 온체인 에이전트 탐색, 동기화
  - `services/ingest` — 요청 수집, 게이트웨이 프록시
  - `services/apigateway` — 리버스 프록시/라우터
- 공유 코드: `services/common/go/` (Go), `services/common/sdk/` (TypeScript)
- 대시보드: `dashboard/` (Next.js 16 + React 19 + Tailwind 4)
- 컨트랙트: `contracts/` (Solidity — 있으면)
- 인프라: `infra/testnet/` (Terraform + GCP)
- Python 에이전트: `agents/` (companion-agent, friend-agent)
- 문서 출력 경로: `docs/`

## 핵심 규칙

1. **코드가 진실이다.** README나 plans.md가 아닌, 실제 `.go`, `.ts`, `.sol` 파일을 읽고 문서를 만들어라.
2. **없는 기능을 적지 마라.** 파일이 존재하지 않거나 TODO인 기능은 "미구현"으로 명시.
3. **기존 docs/ 파일은 덮어쓴다.** 항상 현재 코드 기준으로 최신화.

## 대상 선택

`$ARGUMENTS`에서 target을 파싱한다. 기본값은 `all`.

- `services` → `docs/services.md` 생성 (전체 Go 서비스)
- `dashboard` → `docs/dashboard.md` 생성
- `sdk` → `docs/sdk.md` 생성
- `contracts` → `docs/contracts.md` 생성
- `database` → `docs/database.md` 생성 (전체 서비스 migration SQL 기반)
- `infra` → `docs/infra.md` 생성
- `agents` → `docs/agents.md` 생성
- `all` → 전부 생성

---

## Phase 1: 코드 스캔

각 대상 디렉토리에서 **실제 존재하는 파일**만 수집한다.

### Services (Go 마이크로서비스)

#### Registry (`services/registry/backend`)
```
Glob: services/registry/backend/**/*.go
Glob: services/registry/backend/internal/store/migrations/*.sql
Read: services/registry/backend/go.mod
Read: services/registry/backend/cmd/registryd/main.go
Read: services/registry/backend/internal/server/router.go
Read: services/registry/backend/internal/config/config.go
```

#### Analytics (`services/analytics`)
```
Glob: services/analytics/**/*.go
Glob: services/analytics/internal/store/migrations/*.sql
Read: services/analytics/go.mod
Read: services/analytics/cmd/analyticsd/main.go
Read: services/analytics/internal/server/router.go (있으면)
Read: services/analytics/internal/config/config.go
```

#### Discovery (`services/discovery`)
```
Glob: services/discovery/**/*.go
Glob: services/discovery/internal/store/migrations/*.sql
Read: services/discovery/go.mod
Read: services/discovery/cmd/discoveryd/main.go
Read: services/discovery/internal/server/router.go (있으면)
Read: services/discovery/internal/config/config.go
```

#### Ingest (`services/ingest`)
```
Glob: services/ingest/**/*.go
Read: services/ingest/go.mod
Read: services/ingest/cmd/ingestd/main.go
Read: services/ingest/internal/config/config.go
```

#### API Gateway (`services/apigateway`)
```
Glob: services/apigateway/**/*.go
Read: services/apigateway/go.mod
Read: services/apigateway/cmd/apigatewayd/main.go
Read: services/apigateway/internal/router/router.go
```

### Dashboard (`dashboard/`)
```
Glob: dashboard/src/**/*.{ts,tsx}
Read: dashboard/package.json
Read: dashboard/src/lib/api.ts
Read: dashboard/src/lib/hooks.ts
Read: dashboard/src/lib/auth.tsx
Read: dashboard/src/lib/erc8004.ts
Read: dashboard/src/lib/networks.ts
Read: dashboard/src/lib/wallet.ts
Read: dashboard/src/lib/oasf-taxonomy.ts
Read: dashboard/src/components/Sidebar.tsx
```

### SDK (`services/common/`)
```
Glob: services/common/go/**/*.go
Glob: services/common/sdk/src/**/*.ts
Read: services/common/go/go.mod
Read: services/common/sdk/package.json
Read: services/common/sdk/src/index.ts
Read: services/common/sdk/src/client.ts
Read: services/common/sdk/src/logger.ts
Read: services/common/sdk/src/types.ts
Read: services/common/sdk/src/middleware/express.ts
```

### Contracts (`contracts/`)
```
Glob: contracts/**/*.sol
Glob: contracts/**/foundry.toml (있으면)
```

### Infra (`infra/`)
```
Glob: infra/**/*.tf
Read: infra/testnet/main.tf
Read: infra/testnet/variables.tf
Read: infra/testnet/cloudrun.tf
Read: infra/testnet/cloudsql.tf
Read: infra/testnet/terraform.tfvars.example
```

### Agents (`agents/`)
```
Glob: agents/*/app/**/*.py
Glob: agents/*/erc8004/**/*.py
Read: agents/companion-agent/app/main.py (있으면)
Read: agents/friend-agent/app/main.py (있으면)
Read: agents/*/requirements.txt
```

---

## Phase 2: 코드 분석

각 대상에 대해 다음을 파악한다. **코드에서 직접 읽어서** 확인한다.

### 서비스 분석 (Go) — 각 서비스별 반복

1. **main.go**: 초기화 순서, 주입되는 의존성 목록
2. **router.go**: 등록된 라우트 전체 목록 (Method + Path + Handler)
3. **handler/*.go**: 각 핸들러의 요청/응답 구조 (JSON 필드명)
4. **store/migrations/*.sql**: 테이블 정의, 컬럼, 제약조건
5. **erc8004/**: ERC-8004 레지스트리 연동 로직 (있으면)
6. **sync/**: 네트워크 에이전트 동기화 로직 (있으면)
7. **cache/**: Redis 캐시 레이어 (있으면)
8. **metrics/**: Prometheus 메트릭 (있으면)
9. **go.mod**: 주요 외부 의존성 + 버전, 모듈명

### 대시보드 분석 (Next.js)
1. **src/app/**: App Router 페이지 목록 (동적 라우트 포함)
2. **src/app/create/**: Create Agent 7단계 위저드 구조
3. **src/lib/api.ts**: API 클라이언트 함수 + TypeScript 타입/인터페이스
4. **src/lib/hooks.ts**: 커스텀 훅 목록
5. **src/lib/auth.tsx**: 인증 로직 (AuthContext, 지갑 로그인)
6. **src/lib/erc8004.ts**: ERC-8004 컨트랙트 인터랙션 (registerNewAgent, updateAgentURI 등)
7. **src/lib/networks.ts**: 지원 네트워크 설정
8. **src/lib/wallet.ts**: MetaMask 지갑 연결
9. **src/components/**: 공유 컴포넌트 목록
10. **package.json**: 주요 의존성

### SDK 분석
1. **Go 패키지**: identity, ws, types 각 패키지의 exported 함수/타입
2. **TypeScript SDK**: GT8004Client 메서드, AELLogger, 미들웨어

### 인프라 분석
1. **Terraform 리소스**: Cloud Run 서비스, Cloud SQL, VPC, IAM
2. **환경 변수**: terraform.tfvars.example에서 추출

### 에이전트 분석
1. **Python 진입점**: main.py의 FastAPI 라우트
2. **A2A 통신**: a2a/ 모듈 구조
3. **ERC-8004 등록**: erc8004/ 모듈의 민팅 로직

### 컨트랙트 분석
1. **Solidity**: 함수 시그니처, modifier, 이벤트, 상수

---

## Phase 3: 문서 생성

### `docs/services.md` 형식

```markdown
# GT8004 Services

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 아키텍처 개요
[전체 서비스 간 관계 다이어그램 — 각 서비스 역할 1줄 요약]

## 서비스 의존성 그래프
[모듈명, 공유 의존성, 외부 시스템(PostgreSQL, Redis, RPC)]

---

## Registry Service (`services/registry/backend`)
### 개요
[main.go에서 파악한 서비스 설명]
### 모듈
`github.com/GT8004/gt8004`
### API 엔드포인트
[router.go에서 추출한 전체 라우트 테이블]
| Method | Path | Handler | 설명 |
### 핵심 패키지
[handler, store, erc8004, cache, metrics 각 역할]
### 환경 변수
[config.go에서 추출]
| 변수 | 설명 | 기본값 |
### 의존성
[go.mod에서 추출한 주요 라이브러리]
### 빌드
`go build ./cmd/registryd/`

---

## Analytics Service (`services/analytics`)
[위와 동일한 구조]

---

## Discovery Service (`services/discovery`)
[위와 동일한 구조]

---

## Ingest Service (`services/ingest`)
[위와 동일한 구조]

---

## API Gateway (`services/apigateway`)
[위와 동일한 구조]

---

## 미구현 항목
[각 서비스별 TODO 주석이 있는 부분]
```

### `docs/database.md` 형식

```markdown
# Database Schema

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[전체 DB 구조 요약 — 서비스별 분리된 스키마 설명]

## Registry 테이블
[services/registry/backend/internal/store/migrations/*.sql에서 추출]
### 테이블명
| Column | Type | Default | Description |
[인덱스, 제약조건]

## Analytics 테이블
[services/analytics/internal/store/migrations/*.sql에서 추출]
### 테이블명
| Column | Type | Default | Description |

## Discovery 테이블
[services/discovery/internal/store/migrations/*.sql에서 추출]
### 테이블명
| Column | Type | Default | Description |

## ER Diagram
[테이블 간 관계 ASCII 다이어그램]

## Data Type Conventions
[프로젝트 내 타입 규칙 정리]

## Migration Files
[서비스별 마이그레이션 파일 위치와 목록]
```

### `docs/dashboard.md` 형식

```markdown
# GT8004 Dashboard

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[대시보드 역할 1~2문장]

## 기술 스택
[Next.js 버전, React 버전, Tailwind, ethers.js 등 package.json 기반]

## 페이지 목록
[src/app/ 디렉토리에서 추출한 페이지 목록과 역할]
| 경로 | 페이지 | 설명 |

## Create Agent 위저드
[src/app/create/ 의 7단계 위저드 구조 설명]
| Step | 컴포넌트 | 설명 |

## 라이브러리 (src/lib/)
### api.ts
[API 클라이언트 함수 목록 + 주요 타입]
### auth.tsx
[AuthContext, 인증 플로우]
### erc8004.ts
[컨트랙트 인터랙션 함수 — registerNewAgent, updateAgentURI, encodeDataUri 등]
### networks.ts
[지원 네트워크 목록 + NetworkConfig 타입]
### wallet.ts
[MetaMask 연결 유틸]
### hooks.ts
[커스텀 훅 목록]
### oasf-taxonomy.ts
[OASF 스킬/도메인 분류 체계]

## 컴포넌트
[src/components/ 목록 + 각 역할]

## 인증 플로우
[지갑 로그인 / API 키 로그인 흐름 설명]
```

### `docs/sdk.md` 형식

```markdown
# GT8004 SDK & Common Packages

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## Go 패키지 (`services/common/go`)
### identity/
[함수 시그니처 + 역할]
### ws/
[Hub 구조 + Subscribe/Broadcast 메서드]
### types/
[공유 타입 정의]

## TypeScript SDK (`services/common/sdk`)
### GT8004Client
[클래스 메서드 + 옵션 — client.ts에서 추출]
### AELLogger
[클래스 메서드 + 옵션 — logger.ts에서 추출]
### Transport
[transport.ts에서 추출]
### Middleware
[middleware/express.ts에서 추출]
### Types
[types.ts에서 추출한 공유 타입]
```

### `docs/contracts.md` 형식

```markdown
# GT8004 Contracts

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## ERC-8004 Identity Registry
[Go 서비스의 erc8004/ 패키지와 dashboard의 erc8004.ts에서 추출한 ABI]
### 함수
| 함수 | 파라미터 | 설명 |
### 이벤트
| 이벤트 | 파라미터 | 설명 |
### 배포 정보
[networks.ts에서 추출한 컨트랙트 주소 + 체인 ID]

## Escrow (있으면)
[contracts/escrow/src/*.sol에서 추출]

## Reputation Registry (있으면)
[erc8004/reputation.go에서 추출한 ABI]
```

### `docs/infra.md` 형식

```markdown
# GT8004 Infrastructure

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[인프라 구조 요약 — GCP 기반]

## Terraform 리소스
### Cloud Run 서비스
[cloudrun.tf에서 추출한 서비스 목록, 이미지, 포트, 환경 변수]
### Cloud SQL
[cloudsql.tf에서 추출한 DB 인스턴스 설정]
### VPC / 네트워크
[vpc.tf에서 추출]
### IAM
[iam.tf에서 추출한 서비스 계정, 역할]
### Artifact Registry
[artifact_registry.tf에서 추출]

## 환경 변수
[terraform.tfvars.example에서 추출]
| 변수 | 설명 |

## 배포 방법
[scripts/build-push-testnet.sh 기반]
```

### `docs/agents.md` 형식

```markdown
# GT8004 Python Agents

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[Python 에이전트 역할 설명]

## Agent 목록
### companion-agent
[main.py에서 추출한 라우트, 기능, A2A 통신 방식]
### friend-agent
[main.py에서 추출한 라우트, 기능, A2A 통신 방식]

## ERC-8004 등록
[erc8004/mint.py에서 추출한 민팅 프로세스]

## 의존성
[requirements.txt에서 추출한 주요 라이브러리]

## 실행 방법
[Dockerfile 또는 직접 실행 명령어]
```

---

## Phase 4: 검증

1. 생성된 각 `.md` 파일의 API 엔드포인트가 실제 router 코드와 일치하는지 재확인
2. DB 스키마의 테이블/컬럼이 migration SQL과 일치하는지 재확인
3. 미구현으로 표시한 항목이 실제로 코드에 없는지 확인
4. 서비스 간 의존성 관계가 go.mod의 replace 지시문과 일치하는지 확인

---

## Important

- 추측하지 마라. 코드에 없으면 "미구현" 또는 "해당 없음"으로 적어라.
- 한국어로 작성한다.
- 각 문서 상단에 `> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)` 메타를 넣어라.
- plans.md는 참고만 하고, 문서의 근거는 반드시 실제 코드에서 가져와라.
- `database` 대상은 **모든 서비스**의 migrations/*.sql을 읽는다:
  - `services/registry/backend/internal/store/migrations/*.sql`
  - `services/analytics/internal/store/migrations/*.sql`
  - `services/discovery/internal/store/migrations/*.sql`
- SDK 경로는 `services/common/` 이다 (NOT `common/`).
- `contracts/` 디렉토리에 .sol 파일이 없으면, Go 서비스의 erc8004/ 패키지와 dashboard의 erc8004.ts ABI에서 컨트랙트 인터페이스를 추출한다.