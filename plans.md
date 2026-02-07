# AES (Agent Execution Service) 구현 계획

## Context

README.md에 정의된 AES 스펙을 실제 코드로 구현한다. 두 가지 서비스 티어가 존재:

- **AES Lite (서버 모드)**: DB가 원장, Hydra 없음, <1ms, 최저 비용, AES 신뢰 필요
- **AES Pro (Hydra 모드)**: Hydra UTXO가 원장, 에이전트 직접 서명, <50ms, 검증 가능

**API는 동일** — 채널 생성 시 `"mode": "lite"` / `"mode": "pro"` 하나만 다름.
**Lite를 먼저 구현**하고, Pro는 Lite 위에 Hydra 레이어를 추가하는 방식.

**기술 스택**: Go (백엔드) / Next.js (대시보드) / Aiken (CREDIT 민팅, Pro 전용) / Solidity (Escrow) / PostgreSQL

---

## 서비스 티어 비교

| | AES Lite | AES Pro |
|---|---|---|
| 원장 | AES 서버 DB | Hydra UTXO |
| 지연시간 | <1ms | <50ms |
| 비용 | 최저 | 약간 높음 |
| 에이전트 서명 | 불필요 | 직접 서명 |
| 검증 가능성 | ❌ (AES 신뢰) | ✅ (온체인 증명) |
| 분쟁 해결 | AES 중재 | Hydra 스냅샷 증명 |
| 인프라 의존 | PostgreSQL만 | PostgreSQL + Cardano + Hydra |

---

## 디렉토리 구조

**Lite와 Pro는 완전히 분리된 코드베이스**로 관리한다.

```
/AEL
├── lite/                        # ── AES Lite (DB 기반) ──
│   ├── backend/                 # Go — module: github.com/AEL/aes-lite
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── cmd/aesd/main.go
│   │   └── internal/
│   │       ├── config/          # Viper 기반 환경 설정
│   │       ├── server/          # Gin 라우터, 미들웨어
│   │       ├── handler/         # HTTP 핸들러
│   │       ├── channel/         # 채널 엔진 (DB 기반)
│   │       │   ├── engine.go    # Engine 인터페이스 + 타입
│   │       │   └── lite.go      # LiteEngine 구현
│   │       ├── x402/            # x402 결제 미들웨어
│   │       ├── identity/        # ERC-8004 신원 검증
│   │       ├── evm/             # Escrow 컨트랙트 Go 바인딩
│   │       ├── settlement/      # CREDIT→USDC 정산
│   │       ├── store/           # PostgreSQL + 마이그레이션
│   │       └── metrics/         # Prometheus
│   ├── dashboard/               # Next.js — 모니터링 대시보드
│   │   └── src/app/             # App Router 페이지
│   ├── docker-compose.yml       # PostgreSQL + backend + dashboard
│   ├── Makefile
│   └── .env.example
│
├── pro/                         # ── AES Pro (Hydra 기반) ──
│   ├── backend/                 # Go — module: github.com/AEL/aes-pro
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── cmd/aesd/main.go
│   │   └── internal/
│   │       ├── config/
│   │       ├── server/
│   │       ├── handler/
│   │       ├── channel/         # 채널 엔진 (Hydra 기반)
│   │       │   ├── engine.go    # Engine 인터페이스 + 타입
│   │       │   └── pro.go       # ProEngine 구현 (Phase 2)
│   │       ├── hydra/           # Hydra 노드 WebSocket 클라이언트
│   │       ├── cardano/         # 키 생성, CREDIT 민팅
│   │       ├── evm/             # Escrow 컨트랙트 Go 바인딩
│   │       ├── settlement/
│   │       ├── store/
│   │       └── metrics/
│   ├── dashboard/               # Next.js (Phase 2)
│   ├── infra/                   # Hydra/Cardano 노드 설정
│   │   ├── hydra/
│   │   └── cardano/
│   ├── docker-compose.yml       # + cardano-node + hydra-node
│   ├── Makefile
│   └── .env.example
│
├── contracts/                   # ── 공유 스마트 컨트랙트 ──
│   ├── escrow/                  # Solidity (Foundry) — Base Sepolia
│   │   ├── src/AESEscrow.sol
│   │   └── test/AESEscrow.t.sol
│   └── credit/                  # Aiken — CREDIT 민팅 (Pro 전용)
│       └── validators/credit.ak
├── scripts/                     # 개발/배포 스크립트
├── README.md
└── plans.md
```

---

## 핵심 아키텍처 결정

1. **채널 매니저는 인터페이스로 추상화**: `ChannelEngine` 인터페이스를 정의, `LiteEngine`(DB)과 `ProEngine`(Hydra)이 각각 구현
2. **Lite 모드에서 DB가 원장**: 잔액, TX 기록 모두 PostgreSQL에 저장. 즉시 확정 (<1ms)
3. **Pro 모드에서 Hydra UTXO가 원장**: DB는 스냅샷 캐시 용도. 에이전트 직접 서명 필수
4. **API 레이어는 모드 무관**: 핸들러가 `ChannelEngine`을 호출, 내부 구현만 다름
5. **Lite 먼저 구현, Pro는 후에 추가**: Lite로 전체 플로우를 검증한 뒤 Hydra를 얹음

### ChannelEngine 인터페이스

```go
type ChannelEngine interface {
    CreateChannel(ctx, req) (*Channel, error)
    GetChannel(ctx, channelID) (*Channel, error)
    SendTransaction(ctx, channelID, txReq) (*TxResult, error)
    TopupCredits(ctx, channelID, amount) error
    CloseChannel(ctx, channelID) (*Settlement, error)
}

// LiteEngine — DB 기반, Lite 모드
// ProEngine  — Hydra 기반, Pro 모드 (나중에 구현)
```

---

## 데이터베이스 스키마

### channels 테이블
| 컬럼 | 설명 |
|------|------|
| `mode` | `'lite'` 또는 `'pro'` |
| `status` | pending → active → closing → settled |
| `total_usdc_deposited` | Escrow에 예치된 USDC |
| `total_credits_minted` | 발행된 CREDIT |
| `hydra_head_id` | [Pro 전용] Hydra Head ID |

### Lite 전용: credit_balances 테이블 (DB가 원장)
| 컬럼 | 설명 |
|------|------|
| `channel_id` | FK → channels |
| `agent_id` | FK → agents |
| `balance` | 현재 CREDIT 잔액 (원자적 업데이트) |

### 기타 (이전과 동일)
- `agents`, `channel_participants`, `transaction_log`, `events`, `operator_wallets`

---

## API 엔드포인트 (Lite/Pro 공통)

### Public API (에이전트용)
```
POST   /v1/channels                    # 채널 생성 (mode: lite|pro, x402 결제)
GET    /v1/channels/:id                # 채널 상태 조회
POST   /v1/channels/:id/topup         # 크레딧 충전 (x402)
POST   /v1/channels/:id/close         # 채널 종료 + 정산
POST   /v1/channels/:id/tx            # Lite: 즉시 처리 / Pro: unsigned tx 반환
POST   /v1/channels/:id/tx/submit     # [Pro 전용] 서명된 tx 제출
GET    /v1/channels/:id/ws            # WebSocket (고빈도)
POST   /v1/auth/challenge             # ERC-8004 챌린지
POST   /v1/auth/verify                # 서명 검증
```

**Lite 모드 TX 플로우 (심플):**
```
POST /tx { from, to, amount, memo }
→ 서버가 DB 잔액 확인 → 차감/가산 → 즉시 confirmed 응답
```

**Pro 모드 TX 플로우 (서명 필요):**
```
POST /tx { from, to, amount, memo }
→ unsigned tx 반환
POST /tx/submit { tx_hash, signature }
→ Hydra 제출 → confirmed 응답
```

### Admin API (대시보드용) — 이전과 동일

---

## 스마트 컨트랙트

### Escrow (Solidity on Base Sepolia) — Lite/Pro 공통
- 모든 모드에서 USDC 담보 보관. Lite든 Pro든 Escrow에 예치
- `deposit()`, `topup()`, `settle()`, `exitParticipant()`, `emergencyWithdraw()`

### CREDIT 민팅 정책 (Aiken) — Pro 전용
- Lite는 DB에서 CREDIT 잔액을 추적하므로 온체인 토큰 불필요
- Pro에서만 Cardano 네이티브 토큰으로 민팅

---

## 인프라 (Docker Compose)

### `lite/docker-compose.yml` (Phase 1)
| 서비스 | 이미지/빌드 | 포트 |
|--------|-------------|------|
| `backend` | `./backend` (Go) | 8080, 8081 |
| `dashboard` | `./dashboard` (Next.js) | 3000 |
| `postgres` | `postgres:16-alpine` | 5432 |

**Lite는 Cardano/Hydra 노드 없이 동작한다.** 외부 서비스: Base Sepolia RPC, x402 Facilitator

### `pro/docker-compose.yml` (Phase 2)
| 서비스 | 이미지/빌드 | 포트 |
|--------|-------------|------|
| `backend` | `./backend` (Go) | 8080, 8081 |
| `dashboard` | `./dashboard` (Next.js) | 3000 |
| `postgres` | `postgres:16-alpine` | 5432 |
| `cardano-node` | `ghcr.io/intersectmbo/cardano-node:10.1.4` | — |
| `hydra-node` | `ghcr.io/cardano-scaling/hydra-node:0.20.0` | 4001, 5001 |

---

## 구현 순서

### Phase 1: AES Lite MVP + 대시보드 ← 현재 목표

**Step 1: 기반 구축** ✅ 완료
- [x] 전체 디렉토리 구조 생성
- [x] Go 모듈 초기화 + 서버 스켈레톤 (Gin 라우터, config, handler, store)
- [x] DB 마이그레이션 SQL
- [x] Docker Compose (PostgreSQL + backend + dashboard)
- [x] Makefile
- [x] Next.js 대시보드 + 페이지들
- [x] Escrow 컨트랙트 (Solidity) + CREDIT 정책 (Aiken) 초안

**Step 2: Lite 채널 엔진** ✅ 완료
- [x] `ChannelEngine` 인터페이스 정의 (`channel/engine.go`)
- [x] `LiteEngine` 구현 (`channel/lite.go`)
  - DB 트랜잭션으로 잔액 원자적 이동
  - 채널 생성: DB에 채널 + 참여자 + 초기 잔액 기록
  - TX 처리: 발신자 잔액 차감 + 수신자 잔액 가산 (단일 DB tx)
  - 채널 종료: 최종 잔액 기준 정산 데이터 생성
- [x] `credit_balances` 테이블 추가 마이그레이션 (`005_lite_mode.sql`)
- [x] Lite 모드 TX 핸들러 (서명 없이 즉시 처리)
- [x] Handler에 ChannelEngine 주입 + docker-compose Lite 전용 모드 업데이트

**Step 3: 결제 + 인증** ✅ 완료
- [x] x402 결제 미들웨어 (채널 생성, 충전 시) — `x402/middleware.go`
- [x] ERC-8004 신원 검증 — `identity/identity.go` (챌린지-응답 + ECDSA 서명 복원)
- [x] Escrow 컨트랙트 연동 (Go 바인딩) — `evm/escrow.go` (deposit/topup/settle)
- [x] Handler 연결 + 라우터 x402 미들웨어 적용 + main.go 초기화

**Step 4: 채널 라이프사이클 완성** ✅ 완료
- [x] 채널 REST 핸들러 (생성/조회/충전/종료) — Lite 엔진 완전 연결 + WS 이벤트 브로드캐스트
- [x] 정산 플로우 — `settlement/settlement.go` (DB agent EVM 주소 조회 → Escrow.Settle 호출)
- [x] 에이전트 EVM 주소 저장 — 인증 성공 시 `store.UpdateAgentEVMAddress()` 호출
- [x] WebSocket API — `ws/hub.go` (채널별 구독 + 글로벌 Admin 구독, ping/pong, gorilla/websocket)
- [x] ChannelWebSocket + AdminEventsWebSocket 핸들러 구현

**Step 5: 대시보드 연동** ✅ 완료
- [x] Admin API 엔드포인트 실제 구현 (DB 쿼리) — store 레이어 (overview, channel, agent, event, escrow)
- [x] 실시간 이벤트 WebSocket — `useEventStream()` hook → `WsEvent` 타입으로 정렬
- [x] 프론트엔드 `trust_mode` → `mode` 반영, `ChannelDetail` 타입 (잔액 포함)
- [x] Channel 상세 페이지에 Credit Balances 테이블 추가
- [x] 대시보드 빌드 통과 확인

**Step 6: 통합 테스트** ✅ 완료
- [x] LiteEngine 풀 라이프사이클 테스트 (`lite_test.go`): 채널 생성 → TX → 잔액 확인 → 과잉인출 방지 → 충전 → 종료 → 정산
- [x] 다중 TX 테스트: 50건 연속 TX → 잔액/통계 검증
- [x] Handler HTTP 테스트 (`handler_test.go`): mock engine으로 Create/TX/Close/NotFound/BadRequest
- [x] WebSocket Hub 테스트 (`hub_test.go`): 채널 구독 브로드캐스트 + 글로벌 구독
- [x] `go test ./...` 전체 통과

### Phase 2: AES Pro (Hydra 모드)

**Step 7: Pro 엔진**
- [ ] `ProEngine` 구현 (`channel/pro.go`)
- [ ] Hydra 클라이언트 (WebSocket, Init/Close/NewTx)
- [ ] Cardano 키 매니저 (Ed25519 키페어 생성)
- [ ] CREDIT 토큰 민팅 (Blockfrost + cardano-cli)
- [ ] unsigned tx 구성 + 서명 검증 + Hydra 제출
- [ ] Docker Compose에 cardano-node + hydra-node 추가

**Step 8: Pro 정산**
- [ ] Hydra Close → Fanout → 최종 UTXO 읽기
- [ ] CREDIT 잔액 기준 Escrow settle
- [ ] CREDIT 번 (burn)

### Phase 3~4: (README 로드맵대로)
- 다자간 채널, 풀 채널, 스케일링, 프로덕션 준비

### 의존성 그래프
```
Phase 1 (Lite):
[1] 기반 ✅ ──→ [2] Lite엔진 ──→ [3] 결제+인증 ──→ [4] 라이프사이클 ──→ [6] 통합
                                                    ↗
                               [5] 대시보드 연동 ──→

Phase 2 (Pro):
[4] 라이프사이클 ──→ [7] Pro엔진 ──→ [8] Pro 정산
```

---

## 검증 방법

### Phase 1 (Lite)
1. **백엔드**: `go test ./...`
2. **대시보드**: `npm run build`
3. **E2E**: `docker compose up` (backend + postgres + dashboard만) → curl로 채널 생성 → TX → 정산 → 대시보드 확인
4. **컨트랙트**: `forge test` (Escrow)

### Phase 2 (Pro)
1. 위 + Hydra/Cardano 연동 테스트
2. `aiken check` (CREDIT 정책)
3. Lite/Pro 동일 API로 동작 확인
