---
allowed-tools: Read, Glob, Grep, Bash(go build:*), Bash(tree:*), Bash(ls:*), Write, Edit, Task
argument-hint: [target: backend|dashboard|sdk|contracts|database|all]
description: 현재 코드를 기준으로 docs/ 디렉토리에 GT8004 아키텍처 문서를 자동 생성
---

## Context

- Project: GT8004 (Gate 8004) — ERC-8004 AI 에이전트 비즈니스 인텔리전스 플랫폼 + Escrow 결제 보호
- 단일 서비스 구조: `services/unified/` (GT8004 백엔드)
- 대시보드: `dashboard/` (Next.js)
- SDK: `common/sdk/` (TypeScript)
- 공유 Go 패키지: `common/go/`
- 컨트랙트: `contracts/escrow/` (Solidity on Base Sepolia)
- 문서 출력 경로: `docs/`

## 핵심 규칙

1. **코드가 진실이다.** README나 plans.md가 아닌, 실제 `.go`, `.ts`, `.sol` 파일을 읽고 문서를 만들어라.
2. **없는 기능을 적지 마라.** 파일이 존재하지 않거나 TODO인 기능은 "미구현"으로 명시.
3. **기존 docs/ 파일은 덮어쓴다.** 항상 현재 코드 기준으로 최신화.

## 대상 선택

`$ARGUMENTS`에서 target을 파싱한다. 기본값은 `all`.

- `backend` → `docs/backend.md`만 생성
- `dashboard` → `docs/dashboard.md`만 생성
- `sdk` → `docs/sdk.md`만 생성
- `contracts` → `docs/contracts.md`만 생성
- `database` → `docs/database.md`만 생성 (migration SQL 기반)
- `all` → 전부 생성

---

## Phase 1: 코드 스캔

각 대상 디렉토리에서 **실제 존재하는 파일**만 수집한다.

### Backend (`services/unified/`)
```
Glob: services/unified/backend/**/*.go
Glob: services/unified/backend/internal/store/migrations/*.sql
Read: services/unified/backend/go.mod
Read: services/unified/backend/cmd/gt8004d/main.go
Read: services/unified/backend/internal/server/router.go
Read: services/unified/backend/internal/config/config.go
```

### Dashboard (`dashboard/`)
```
Glob: dashboard/src/**/*.{ts,tsx}
Read: dashboard/package.json
Read: dashboard/src/lib/api.ts
Read: dashboard/src/lib/hooks.ts
Read: dashboard/src/lib/auth.ts (있으면)
Read: dashboard/src/components/Sidebar.tsx
```

### SDK (`common/`)
```
Glob: common/go/**/*.go
Glob: common/sdk/src/**/*.ts
Read: common/go/go.mod
Read: common/sdk/package.json
Read: common/sdk/src/index.ts
```

### Contracts (`contracts/`)
```
Glob: contracts/escrow/src/*.sol
Glob: contracts/escrow/test/*.sol (있으면)
Glob: contracts/identity/src/*.sol (있으면)
Read: contracts/escrow/foundry.toml (있으면)
```

---

## Phase 2: 코드 분석

각 대상에 대해 다음을 파악한다. **코드에서 직접 읽어서** 확인한다.

### 백엔드 분석 (Go)
1. **main.go**: 초기화 순서, 주입되는 의존성 목록
2. **router.go**: 등록된 라우트 전체 목록 (Method + Path + Handler)
3. **handler/*.go**: 각 핸들러의 요청/응답 구조 (JSON 필드명)
4. **store/migrations/*.sql**: 테이블 정의, 컬럼, 제약조건
5. **erc8004/**: ERC-8004 레지스트리 연동 로직
6. **sync/**: 네트워크 에이전트 동기화 로직
7. **cache/**: Redis 캐시 레이어
8. **go.mod**: 주요 외부 의존성 + 버전

### 대시보드 분석 (Next.js)
1. **src/app/**: App Router 페이지 목록
2. **src/lib/api.ts**: API 클라이언트 함수 + TypeScript 타입/인터페이스
3. **src/lib/hooks.ts**: 커스텀 훅 목록
4. **src/lib/auth.ts**: 인증 로직
5. **src/components/**: 공유 컴포넌트 목록
6. **package.json**: 주요 의존성

### 컨트랙트 분석
1. **Solidity**: 함수 시그니처, modifier, 이벤트, 상수

---

## Phase 3: 문서 생성

### `docs/backend.md` 형식

```markdown
# GT8004 Backend

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[main.go에서 파악한 서비스 설명 1~2문장]

## 아키텍처
[main.go 초기화 흐름 기반 다이어그램]

## 디렉토리 구조
[실제 파일 기반 tree — 존재하는 파일만]

## API 엔드포인트
[router.go에서 추출한 전체 라우트 테이블]
| Method | Path | Handler | 설명 |

## 핵심 타입/인터페이스
[Go 구조체 중 주요한 것 — Agent, Handler 등]

## 환경 변수
[config.go에서 추출]
| 변수 | 설명 | 기본값 |

## 의존성
[go.mod에서 추출한 주요 라이브러리]

## 빌드 & 실행
[Dockerfile 또는 직접 빌드 명령어]

## 미구현 항목
[코드에 TODO 주석이 있는 부분]
```

### `docs/database.md` 형식

```markdown
# Database Schema

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[서비스가 사용하는 DB 구조 요약]

## 테이블
[migrations/*.sql에서 추출한 모든 테이블 정의]
### 테이블명
[테이블 설명]
| Column | Type | Default | Description |
[인덱스, 제약조건]

## ER Diagram
[테이블 간 관계 ASCII 다이어그램]

## Data Type Conventions
[프로젝트 내 타입 규칙 정리]

## Migration Files
[마이그레이션 파일 위치와 목록]
```

### `docs/dashboard.md` 형식

```markdown
# GT8004 Dashboard

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## 개요
[대시보드 역할 1~2문장]

## 페이지 목록
[src/app/ 디렉토리에서 추출한 페이지 목록과 역할]
| 경로 | 페이지 | 설명 |

## API 클라이언트
[src/lib/api.ts에서 추출한 함수 목록]

## 커스텀 훅
[src/lib/hooks.ts에서 추출]

## 인증
[src/lib/auth.ts에서 추출한 인증 플로우]

## 컴포넌트
[src/components/ 목록]

## 의존성
[package.json에서 추출한 주요 라이브러리]
```

### `docs/sdk.md` 형식

```markdown
# GT8004 SDK

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## Go 패키지 (common/go)
### identity/
[함수 시그니처 + 역할]
### ws/
[Hub 구조 + Subscribe/Broadcast 메서드]
### types/
[공유 타입 정의]

## TypeScript SDK (common/sdk)
### GT8004Client
[클래스 메서드 + 옵션]
### AELLogger
[클래스 메서드 + 옵션]
### Middleware
[미들웨어 동작]
```

### `docs/contracts.md` 형식

```markdown
# GT8004 Contracts

> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)

## Escrow (Solidity — Base Sepolia)
### 함수
| 함수 | 파라미터 | 설명 |
### 이벤트
| 이벤트 | 파라미터 | 설명 |
### 배포 정보

## Identity Registry (있으면)
[ERC-8004 레지스트리 컨트랙트]
```

---

## Phase 4: 검증

1. 생성된 각 `.md` 파일의 API 엔드포인트가 실제 router 코드와 일치하는지 재확인
2. DB 스키마의 테이블/컬럼이 migration SQL과 일치하는지 재확인
3. 미구현으로 표시한 항목이 실제로 코드에 없는지 확인

---

## Important

- 추측하지 마라. 코드에 없으면 "미구현" 또는 "해당 없음"으로 적어라.
- 한국어로 작성한다.
- 각 문서 상단에 `> 마지막 생성: YYYY-MM-DD (코드 기준 자동 생성)` 메타를 넣어라.
- plans.md는 참고만 하고, 문서의 근거는 반드시 실제 코드에서 가져와라.
- `database` 대상은 `services/unified/backend/internal/store/migrations/*.sql` 파일을 모두 읽어 테이블 정의, 컬럼, 인덱스, 제약조건을 추출한다.