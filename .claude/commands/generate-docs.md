---
allowed-tools: Read, Glob, Grep, Bash(go build:*), Bash(tree:*), Bash(ls:*), Write, Edit, Task
argument-hint: [tier: open|lite|pro|all]
description: 현재 코드를 기준으로 docs/ 디렉토리에 Open/Lite/Pro 아키텍처 문서를 자동 생성
---

## Context

- Project: AES (Agent Execution Service) — AI 에이전트 비즈니스 인프라 플랫폼
- 3티어 구조: Open (무료 BI) / Lite (DB Escrow) / Pro (Hydra 채널)
- 문서 출력 경로: `docs/`
- 루트 README.md: 서비스 전체 스펙 (비즈니스 모델, API 레퍼런스)

## 핵심 규칙

1. **코드가 진실이다.** README나 plans.md가 아닌, 실제 `.go`, `.ts`, `.sol`, `.ak` 파일을 읽고 문서를 만들어라.
2. **없는 기능을 적지 마라.** 파일이 존재하지 않거나 TODO인 기능은 "미구현"으로 명시.
3. **기존 docs/ 파일은 덮어쓴다.** 항상 현재 코드 기준으로 최신화.

## 대상 선택

`$ARGUMENTS`에서 tier를 파싱한다. 기본값은 `all`.

- `open` → `docs/open.md`만 생성
- `lite` → `docs/lite.md`만 생성
- `pro` → `docs/pro.md`만 생성
- `all` → 3개 전부 + `docs/common.md` + `docs/contracts.md`

---

## Phase 1: 코드 스캔

각 티어 디렉토리에서 **실제 존재하는 파일**만 수집한다.

### Open (`services/open/`)
```
Glob: services/open/backend/**/*.go
Glob: services/open/backend/internal/store/migrations/*.sql
Glob: dashboard/src/**/*.{ts,tsx}
Read: services/open/backend/go.mod
Read: services/open/backend/cmd/aesd/main.go
Read: services/open/docker-compose.yml (있으면)
Read: services/open/.env.example (있으면)
```

### Lite (`services/lite/`)
```
Glob: services/lite/backend/**/*.go
Glob: services/lite/backend/internal/store/migrations/*.sql
Glob: dashboard/src/**/*.{ts,tsx}
Read: services/lite/backend/go.mod
Read: services/lite/backend/cmd/aesd/main.go
Read: services/lite/docker-compose.yml (있으면)
Read: services/lite/.env.example (있으면)
```

### Pro (`services/pro/`)
```
Glob: services/pro/backend/**/*.go
Read: services/pro/backend/go.mod (있으면)
Read: services/pro/docker-compose.yml (있으면)
```

### Common (`common/`)
```
Glob: common/go/**/*.go
Glob: common/sdk/src/**/*.ts
Read: common/go/go.mod
Read: common/sdk/package.json
```

### Contracts (`contracts/`)
```
Glob: contracts/escrow/src/*.sol
Glob: contracts/escrow/test/*.sol
Glob: contracts/credit/validators/*.ak
Read: contracts/escrow/foundry.toml
Read: contracts/credit/aiken.toml (있으면)
```

---

## Phase 2: 코드 분석

각 티어에 대해 다음을 파악한다. **코드에서 직접 읽어서** 확인한다.

### 백엔드 분석 (Go)
1. **main.go**: 초기화 순서, 주입되는 의존성 목록
2. **router.go / server.go**: 등록된 라우트 전체 목록 (Method + Path + Handler)
3. **handler/*.go**: 각 핸들러의 요청/응답 구조 (JSON 필드명)
4. **store/migrations/*.sql**: 테이블 정의, 컬럼, 제약조건
5. **channel/engine.go**: 인터페이스 메서드 시그니처 (Lite/Pro)
6. **go.mod**: 주요 외부 의존성 + 버전

### 대시보드 분석 (Next.js)
1. **src/app/**: App Router 페이지 목록
2. **src/lib/api.ts**: API 클라이언트 함수 + TypeScript 타입/인터페이스
3. **src/lib/hooks.ts**: 커스텀 훅 목록
4. **package.json**: 주요 의존성

### 컨트랙트 분석
1. **Solidity**: 함수 시그니처, modifier, 이벤트, 상수
2. **Aiken**: validator 로직, 파라미터, 액션 타입

---

## Phase 3: 문서 생성

각 파일을 아래 형식으로 생성한다.

### `docs/open.md` 형식

```markdown
# AES Open — [현재 상태: 구현 중 / 완료]

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

## 데이터베이스 스키마
[migrations/*.sql에서 추출한 테이블 정의]
### 테이블명
| 컬럼 | 타입 | 제약조건 | 설명 |

## 핵심 타입/인터페이스
[Go 구조체, TypeScript 인터페이스 중 주요한 것]

## 환경 변수
[config.go 또는 .env.example에서 추출]
| 변수 | 설명 | 기본값 |

## 의존성
[go.mod, package.json에서 추출한 주요 라이브러리]

## 빌드 & 실행
[Makefile 또는 Dockerfile에서 추출한 명령어]

## 대시보드 페이지
[src/app/ 디렉토리에서 추출한 페이지 목록과 역할]

## 미구현 항목
[plans.md에서 TODO인 항목, 또는 코드에 TODO 주석이 있는 부분]
```

### `docs/lite.md`, `docs/pro.md`도 동일 형식

추가 섹션:
- **채널 라이프사이클**: Engine 인터페이스 메서드 기반 플로우
- **Escrow 연동**: evm/escrow.go의 메서드 + ABI
- **정산 플로우**: settlement 패키지 로직

### `docs/common.md` 형식

```markdown
# AES Common — 공유 패키지

## Go 패키지 (github.com/AEL/aes-common)
### identity/
[함수 시그니처 + 역할]
### ws/
[Hub 구조 + Subscribe/Broadcast 메서드]
### types/
[공유 타입 정의]

## TypeScript SDK (@aes-network/sdk)
### AESLogger
[클래스 메서드 + 옵션]
### BatchTransport
[전송 로직]
### Express Middleware
[미들웨어 동작]
```

### `docs/contracts.md` 형식

```markdown
# AES Contracts

## Escrow (Solidity — Base Sepolia)
### 함수
| 함수 | 접근제어 | 설명 |
### 이벤트
### 상수
### 배포 정보

## CREDIT (Aiken — Cardano)
### Validator 로직
### 파라미터
### 액션 타입
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
