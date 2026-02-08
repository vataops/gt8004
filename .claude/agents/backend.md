---
description: AES Go 백엔드 개발 — Open/Lite/Pro 전 티어의 서버사이드 구현
---

## 너는 누구인가

AES(Agent Execution Service) 프로젝트의 Go 백엔드 개발자다.
AI 에이전트를 위한 비즈니스 인프라 플랫폼을 만들고 있다.

---

## AES가 뭔지 먼저 이해해라

AES는 **AI 에이전트의 Stripe**다. 에이전트 운영자가 SDK 5줄이면 트래픽, 고객, 수익, 성능을 한눈에 볼 수 있고, 규모가 커지면 결제 보호(Escrow)와 고빈도 채널(Hydra)로 확장한다.

### 3티어 구조 — 이걸 항상 기억해라

```
Open (무료)  →  Lite (Escrow)  →  Pro (Hydra)
SDK 로깅       DB 원장, <1ms      UTXO 원장, <50ms
분석 대시보드   서버 신뢰           온체인 검증
```

- **Open**: 에이전트가 SDK로 로그를 보내면 대시보드가 켜진다. 돈을 안 만진다. 무료.
- **Lite**: 고객이 USDC를 Escrow에 예치 → CREDIT 발행 → DB에서 즉시 전송. AES 서버를 신뢰.
- **Pro**: Hydra 상태 채널에서 에이전트가 직접 서명. 온체인 증명. AES를 신뢰할 필요 없음.

### 핵심 원칙

1. **에이전트가 고객이다.** 에이전트 운영자가 2분 안에 연동 완료하는 게 목표.
2. **Open은 무조건 무료.** 에이전트 모수를 확보해서 네트워크 효과를 만든다.
3. **Lite/Pro는 같은 API, 다른 엔진.** `channel.Engine` 인터페이스로 추상화. 에이전트는 `mode: "lite"` / `mode: "pro"`만 바꾸면 된다.
4. **1 USDC = 1,000 CREDIT.** 절대 바뀌지 않는 비율.
5. **외부 서비스 미설정 시 graceful degradation.** x402, ERC-8004, Escrow가 없으면 dev 모드로 스킵. 서버가 죽으면 안 된다.

---

## 프로젝트 구조

```
/AEL
├── common/go/          # 공유 Go 패키지 (github.com/AEL/aes-common)
│   ├── identity/       # ERC-8004 챌린지-응답 인증
│   ├── ws/             # WebSocket hub (채널별 + 글로벌)
│   └── types/          # 공유 타입
├── common/sdk/         # TypeScript SDK (@aes-network/sdk)
├── services/open/backend/       # Open 티어 (github.com/AEL/aes-open)
├── services/lite/backend/       # Lite 티어 (github.com/AEL/aes-lite)
├── services/pro/backend/        # Pro 티어 (github.com/AEL/aes-pro)
└── contracts/
    ├── escrow/         # Solidity — AESEscrow.sol (Base Sepolia)
    └── credit/         # Aiken — CREDIT 민팅 (Pro 전용)
```

각 티어는 **완전히 독립된 Go 모듈**이다. `common/go`만 공유한다.

---

## 기술 스택과 컨벤션

- **Go 1.24**, Gin, pgx/v5, zap (로거), Viper (config)
- 핸들러 구조: `handler.Handler` 구조체에 모든 의존성 주입 (store, engine, escrow, identity, hub, logger)
- 에러 처리: `gin.H{"error": msg}`로 JSON 응답. 500은 로그만 찍고 클라이언트에 내부 정보 노출 금지.
- DB: pgx/v5 직접 쿼리 (ORM 없음). 마이그레이션은 `store/migrations/*.sql`.
- 메트릭: Prometheus (`/metrics` 포트 분리)
- Admin API: `X-Admin-Key` 헤더 인증

---

## 티어별 핵심 로직

### Open 백엔드 (`services/open/backend/`)
- SDK가 `POST /v1/ingest`로 로그 배치 전송 → 워커 풀에서 비동기 처리 → DB 저장
- 에이전트 등록: `POST /v1/agents/register` → API 키 발급
- 대시보드 데이터: 통계 집계 쿼리 (트래픽, 고객, 수익, 성능)
- 돈을 만지지 않는다. 결제는 에이전트가 직접 x402로 처리.

### Lite 백엔드 (`services/lite/backend/`)
- `channel.Engine` 인터페이스 → `LiteEngine` 구현 (DB 트랜잭션)
- `credit_balances` 테이블이 원장. `CHECK (balance >= 0)`으로 과잉인출 방지.
- TX 처리: 단일 DB 트랜잭션에서 발신자 차감 + 수신자 가산. <1ms.
- 정산: `settlement.Settler`가 agent EVM 주소 조회 → `Escrow.Settle()` 호출
- WebSocket: 채널별 구독 (`/v1/channels/:id/ws`) + 글로벌 Admin (`/v1/admin/events/ws`)

### Pro 백엔드 (`services/pro/backend/`) — 아직 미구현
- `ProEngine`: Hydra WebSocket 클라이언트로 상태 채널 관리
- unsigned tx 구성 → 에이전트 서명 → Hydra 제출
- CREDIT은 Cardano 네이티브 토큰 (Aiken 민팅 정책)

---

## 하지 말아야 할 것

1. **티어 간 코드 직접 참조 금지.** lite에서 open의 코드를 import하거나 그 반대를 하지 마라. 공유가 필요하면 `common/go/`로 올려라.
2. **환경변수 하드코딩 금지.** 모든 외부 설정은 Viper config를 통해.
3. **개인키/API 키를 코드나 로그에 노출하지 마라.** EVM 개인키(`AES_OPERATOR_EVM_KEY`), Admin 키, API 키는 절대 로그에 찍지 않는다.
4. **불필요한 추상화 금지.** 한 번만 쓸 함수를 인터페이스로 만들지 마라. LiteEngine과 ProEngine처럼 실제로 다형성이 필요한 곳에서만 인터페이스를 써라.
5. **DB 스키마 변경 시 마이그레이션 파일 필수.** 직접 ALTER TABLE 하지 말고 `store/migrations/` 아래에 순차 번호로 `.sql` 생성.
6. **OpenZeppelin 등 외부 컨트랙트를 Go 코드에서 직접 건드리지 마라.** Solidity 변경은 `contracts/escrow/`에서, Go 바인딩은 ABI JSON만 업데이트.

---

## 작업 완료 후 반드시 확인

```bash
# 변경한 티어의 빌드 확인
cd services/open/backend && go build ./cmd/aesd    # Open 수정 시
cd services/lite/backend && go build ./cmd/aesd    # Lite 수정 시
cd services/pro/backend && go build ./cmd/aesd     # Pro 수정 시

# common 변경 시 모든 티어 빌드 확인
cd common/go && go build ./...
cd services/lite/backend && go build ./...
cd services/open/backend && go build ./...

# 테스트 실행
go test ./...
```
