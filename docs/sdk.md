# GT8004 SDK & Common Packages

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## Go 패키지 (`services/common/go`)

**모듈**: `github.com/GT8004/gt8004-common`
**Go 버전**: 1.24.0
**주요 의존성**: go-ethereum v1.16.8, gorilla/websocket v1.4.2, zap v1.27.0

### identity/

ERC-8004 에이전트 신원 검증. 챌린지-서명 기반 인증.

**타입:**
- `AgentInfo` — 에이전트 신원 (ID, EVM 주소, 리퓨테이션 점수, 검증 플래그)
- `ChallengeRequest` — agent_id 포함 요청
- `ChallengeResponse` — 챌린지 hex + 만료 Unix 타임스탬프
- `VerifyRequest` — 챌린지, 서명, agent_id
- `Verifier` — 신원 검증기 구조체

**함수:**
| 함수 | 시그니처 | 설명 |
|------|---------|------|
| `NewVerifier` | `(registryAddress, registryRPC, logger) → *Verifier` | 검증기 인스턴스 생성 |
| `CreateChallenge` | `(agentID) → (*ChallengeResponse, error)` | 32바이트 랜덤 챌린지 생성 (30초 만료) |
| `VerifySignature` | `(VerifyRequest) → (*AgentInfo, error)` | 서명 검증, EVM 주소 복구, 레지스트리 조회 |

**챌린지 플로우:**
1. 32바이트 랜덤 챌린지 생성
2. 메모리에 30초 TTL로 저장
3. 클라이언트가 개인키로 서명
4. Ethereum personal_sign 프리픽스로 검증
5. 공개키 복구 → EVM 주소 도출
6. ERC-8004 레지스트리에서 리퓨테이션 조회
7. AgentInfo 반환

### ws/

WebSocket 연결 관리 허브. 실시간 이벤트 전달.

**타입:**
- `Event` — 브로드캐스트 메시지 (type, channelID, payload, timestamp)
- `Hub` — WebSocket 연결 관리자

**함수:**
| 함수 | 시그니처 | 설명 |
|------|---------|------|
| `NewHub` | `(logger) → *Hub` | 허브 인스턴스 생성 |
| `Subscribe` | `(channelID, ws)` | 채널 구독 추가 |
| `SubscribeGlobal` | `(ws)` | 글로벌(관리자) 구독 |
| `Broadcast` | `(Event)` | 채널 + 글로벌 구독자에게 이벤트 전송 |

**채널 모델:**
- 채널 스코프: 특정 channelID 구독자
- 글로벌: 관리자 구독자 (모든 이벤트 수신)
- 연결당 64 메시지 버퍼
- 전송 실패 시 자동 정리
- Ping/Pong 킵얼라이브 (60초 pongWait의 9/10)

### types/

서비스 간 공유 타입.

**타입:**
```go
type Agent struct {
    ID              uuid.UUID
    AgentID         string          // EVM 주소
    EVMAddress      string          // 옵션
    ReputationScore *float64        // 옵션
    VerifiedAt      *time.Time      // 옵션
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

---

## TypeScript SDK (`services/common/sdk`)

**패키지명**: `@gt8004/sdk`
**버전**: 0.1.0
**출력**: dist/index.js (CJS), dist/index.mjs (ESM), dist/index.d.ts
**피어 의존성**: express >=4.0.0 (옵션)
**개발 의존성**: tsup, TypeScript 5.7, vitest 3.0

### GT8004Client

API 클라이언트 클래스. 모든 백엔드 API 메서드 제공.

**설정:**
| 옵션 | 타입 | 설명 |
|------|------|------|
| `apiKey` | string | 필수 API 키 |
| `endpoint` | string | 커스텀 엔드포인트 (기본: https://api.gt8004.network) |

**Public 메서드:**
| 메서드 | 설명 |
|--------|------|
| `searchAgents(params?)` | 마켓플레이스 에이전트 검색 |
| `getBenchmark(category)` | 카테고리별 벤치마크 데이터 |

**에이전트 분석:**
| 메서드 | 설명 |
|--------|------|
| `getStats(agentId)` | 에이전트 통계 |
| `getPerformance(agentId, window?)` | 성능 메트릭 |
| `getLogs(agentId, limit?)` | 요청 로그 |

**게이트웨이:**
| 메서드 | 설명 |
|--------|------|
| `enableGateway(agentId)` | 게이트웨이 활성화 |
| `disableGateway(agentId)` | 게이트웨이 비활성화 |

**서비스 라이프사이클:**
| 메서드 | 설명 |
|--------|------|
| `registerService(params)` | 서비스 등록 |
| `getService(agentId)` | 서비스 상태 조회 |
| `updateTier(agentId, tier, evmAddress?)` | 티어 업/다운그레이드 |
| `deregister(agentId)` | 서비스 해제 |

**ERC-8004:**
| 메서드 | 설명 |
|--------|------|
| `authChallenge(agentId)` | 챌린지 요청 |
| `verifyToken(tokenId)` | 토큰 온체인 검증 |
| `linkERC8004(agentId, params)` | ERC-8004 토큰 연결 |

### GT8004Logger

요청 로그 수집기. 배치 전송 + 자동 플러시.

**설정:**
| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `agentId` | string | (필수) | 에이전트 ID |
| `apiKey` | string | (필수) | API 키 |
| `endpoint` | string | https://api.gt8004.xyz | 수집 엔드포인트 |
| `batchSize` | number | 50 | 배치 크기 |
| `flushIntervalMs` | number | 5000 | 플러시 주기 (ms) |
| `maxRetries` | number | 3 | 재시도 횟수 |
| `debug` | boolean | false | 디버그 로깅 |

**메서드:**
| 메서드 | 설명 |
|--------|------|
| `middleware(options?)` | Express 미들웨어 (자동 로그 캡처) |
| `logRequest(entry)` | 수동 로그 등록 |
| `flush()` | 대기 중인 로그 즉시 전송 |
| `close()` | 로거 종료 (플러시 후) |

### Transport (BatchTransport)

배치 전송 레이어.

- 배치 크기: 기본 50건
- 플러시 주기: 기본 5초
- 지수 백오프 재시도 (최대 3회, 2^n초)
- 서킷 브레이커: 연속 5회 실패 시 30초 백오프
- Node.js 종료 시 자동 타이머 정리
- POST 엔드포인트: `/v1/ingest`

### Middleware (Express)

Express 미들웨어. 요청/응답을 자동 캡처.

**옵션:**
| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `extractCustomerId` | `(req) → string` | | 커스텀 고객 ID 추출 |
| `extractToolName` | `(req) → string` | | 커스텀 도구 이름 추출 |
| `captureBody` | boolean | true | 바디 캡처 여부 |
| `maxBodySize` | number | 16384 (16KB) | 최대 바디 크기 |

**자동 캡처 데이터:**
- HTTP 메서드, 경로, 상태 코드, 응답 시간
- 요청/응답 바디 (크기 제한)
- HTTP 헤더 (user-agent, content-type, referer, x-agent-id, accept-language)
- 클라이언트 IP (X-Forwarded-For → X-Real-IP → socket)
- x402 결제 헤더 (amount, tx_hash, token, payer)
- 경로 마지막 세그먼트로 도구 이름 자동 추출

### Types

**RequestLogEntry 필드:**
```typescript
interface RequestLogEntry {
  requestId: string;           // UUID
  customerId?: string;         // 고객 식별자
  toolName?: string;           // 도구 이름
  method: string;              // HTTP 메서드
  path: string;                // 요청 경로
  statusCode: number;          // HTTP 상태 코드
  responseMs: number;          // 응답 시간
  errorType?: string;          // 에러 분류
  x402Amount?: number;         // 결제 금액
  x402TxHash?: string;         // 트랜잭션 해시
  x402Token?: string;          // 토큰 심볼
  x402Payer?: string;          // 지불자 주소
  requestBodySize?: number;
  responseBodySize?: number;
  requestBody?: string;
  responseBody?: string;
  headers?: Record<string, string>;
  protocol?: string;           // http/mcp/a2a
  source?: string;             // sdk/gateway
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  contentType?: string;
  acceptLanguage?: string;
  timestamp: string;           // ISO 8601
}
```
