# GT8004 Python SDK 가이드

## 개요

GT8004 Python SDK는 AI 에이전트의 모든 요청을 자동으로 추적하고 분석 데이터를 GT8004 플랫폼으로 전송하는 라이브러리입니다. FastAPI 미들웨어를 통해 **단 10줄의 코드로 즉시 통합**할 수 있습니다.

### ✨ 핵심 기능

- 🚀 **제로 설정**: 미들웨어 1줄만 추가하면 모든 요청 자동 추적
- 📊 **실시간 대시보드**: `https://gt8004.xyz/agents/{agent-id}`에서 즉시 확인
- ⚡ **논블로킹**: 비동기 배치 전송으로 성능 영향 최소화
- 🔄 **자동 재시도**: Exponential backoff + Circuit breaker
- 🛡️ **안정성**: 네트워크 장애 시에도 데이터 손실 없음

## 설치

```bash
# GitHub에서 직접 설치
pip install git+https://github.com/HydroX-labs/gt8004-sdk.git

# 또는 개발 환경에서 로컬 설치
pip install -e ./sdk-python
```

> **공식 저장소**: https://github.com/HydroX-labs/gt8004-sdk

## 빠른 시작

**단 10줄의 코드로 AI 에이전트 분석 플랫폼에 연결하세요!**

기존 FastAPI 앱에 미들웨어만 추가하면 모든 요청이 자동으로 추적되며,
대시보드에서 실시간 분석을 확인할 수 있습니다: `https://gt8004.xyz/agents/{your-agent-id}`

### 1. 환경 변수 설정

```bash
export GT8004_AGENT_ID="your-agent-id"
export GT8004_API_KEY="your-api-key"
export GT8004_INGEST_URL="http://localhost:9092/v1/ingest"  # Optional
```

### 2. FastAPI 앱에 통합 (10줄만 추가!)

```python
from fastapi import FastAPI
from gt8004 import GT8004Logger
from gt8004.middleware.fastapi import GT8004Middleware
import os

# 1. 로거 초기화 (3줄)
logger = GT8004Logger(
    agent_id=os.getenv("GT8004_AGENT_ID"),
    api_key=os.getenv("GT8004_API_KEY")
)
logger.transport.start_auto_flush()  # 자동 전송 시작

app = FastAPI()

# 2. 미들웨어 추가 (1줄) - 이게 전부입니다!
app.add_middleware(GT8004Middleware, logger=logger)

# 기존 코드는 그대로 유지
@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/chat")
async def chat(message: dict):
    # 기존 비즈니스 로직 - 수정 불필요
    return {"response": "처리 완료"}

# 3. Graceful shutdown (3줄)
@app.on_event("shutdown")
async def shutdown():
    await logger.close()
```

**완료!** 이제 `https://gt8004.xyz/agents/{your-agent-id}`에서 실시간 분석을 확인하세요 📊

### 3. 수동 로깅 (고급)

```python
from gt8004 import GT8004Logger, RequestLogEntry
import uuid

logger = GT8004Logger(
    agent_id="your-agent-id",
    api_key="your-api-key"
)

# 요청 로그 수동 생성
entry = RequestLogEntry(
    request_id=str(uuid.uuid4()),
    method="POST",
    path="/api/chat",
    status_code=200,
    response_ms=142.5,
    customer_id="customer-123",      # 고객 ID (선택)
    tool_name="chat_completion",     # 사용된 도구/기능 (선택)
    request_body='{"message": "안녕"}',
    response_body='{"reply": "안녕하세요"}',
    x402_amount=0.05,                # X-402 결제 금액 (선택)
    x402_tx_hash="0xabc..."          # 트랜잭션 해시 (선택)
)

await logger.log(entry)
await logger.flush()  # 즉시 전송
```

## 데이터 흐름 (End-to-End)

```
┌─────────────┐
│ Your Agent  │
│  (FastAPI)  │
└──────┬──────┘
       │
       │ 1. HTTP Request
       ▼
┌─────────────────────┐
│ GT8004Middleware    │  ← 자동으로 요청 캡처
│ - method, path      │
│ - status, latency   │
│ - request/response  │
└──────┬──────────────┘
       │
       │ 2. RequestLogEntry 생성
       ▼
┌─────────────────────┐
│  GT8004Logger       │
│  - 메모리 큐에 추가  │
│  - 배치 관리         │
└──────┬──────────────┘
       │
       │ 3. 배치가 차면 (50개 또는 5초)
       ▼
┌─────────────────────┐
│  Transport Layer    │
│  - Async HTTP Client│
│  - Retry Logic      │
│  - Circuit Breaker  │
└──────┬──────────────┘
       │
       │ 4. POST /v1/ingest
       ▼
┌─────────────────────┐
│ Analytics Service   │
│ (Port 9092)         │
│ /v1/ingest          │
└──────┬──────────────┘
       │
       │ 5. Validate & Enrich
       │    - API Key 검증
       │    - customer_id 추출
       │    - 타임스탬프 정규화
       ▼
┌─────────────────────┐
│  PostgreSQL DB      │
│  - request_logs     │
│  - 고객별 집계       │
│  - 도구별 통계       │
└─────────────────────┘
```

## 상세 동작 방식

### 1. 미들웨어에서 요청 캡처

FastAPI 미들웨어가 모든 HTTP 요청/응답을 자동으로 가로채서:

```python
# 내부 동작
async def dispatch(request, call_next):
    start = time.time()

    # 요청 본문 읽기 (최대 16KB)
    body = await request.body()

    # 실제 핸들러 실행
    response = await call_next(request)

    # 응답 시간 계산
    duration_ms = (time.time() - start) * 1000

    # 로그 엔트리 생성
    entry = RequestLogEntry(
        request_id=str(uuid.uuid4()),
        method=request.method,
        path=str(request.url.path),
        status_code=response.status_code,
        response_ms=duration_ms,
        request_body=body.decode()[:16384],
        response_body=response_body[:16384],
        # ... 기타 메타데이터
    )

    # 로거에 추가 (비동기, 논블로킹)
    await logger.log(entry)
```

### 2. 배치 처리

로거는 메모리에 로그를 모아서 배치로 전송:

```python
# 내부 큐 관리
self._queue = []
self._batch_size = 50      # 50개 쌓이면 전송
self._flush_interval = 5.0  # 또는 5초마다 전송

# 자동 flush 루프
async def _auto_flush_loop():
    while True:
        await asyncio.sleep(flush_interval)
        await self.flush()
```

**장점:**
- 매 요청마다 HTTP 호출하지 않아 성능 영향 최소화
- 네트워크 오버헤드 감소
- 대량 요청 처리 시 효율적

### 3. 전송 레이어

```python
# Transport.send() 내부
async def send(self, entries: List[RequestLogEntry]):
    payload = {
        "agent_id": self.agent_id,
        "entries": [e.dict() for e in entries]
    }

    headers = {
        "Authorization": f"Bearer {self.api_key}",
        "Content-Type": "application/json"
    }

    # 재시도 로직 (최대 3회, exponential backoff)
    for attempt in range(3):
        try:
            response = await self.client.post(
                f"{self.ingest_url}",
                json=payload,
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            return  # 성공
        except Exception as e:
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)  # 1초, 2초, 4초
            else:
                # Circuit breaker: 연속 실패 시 일시 중단
                self._failure_count += 1
                raise
```

### 4. Analytics Service 처리

```go
// services/analytics/internal/ingest/handler.go
func (h *Handler) Ingest(c *gin.Context) {
    var req IngestRequest
    c.ShouldBindJSON(&req)

    // 1. API Key 검증
    agent, err := h.registry.ValidateAPIKey(req.AgentID, apiKey)

    // 2. 각 엔트리 처리
    for _, entry := range req.Entries {
        // 타임스탬프 정규화
        timestamp := parseTimestamp(entry.Timestamp)

        // customer_id 추출 (헤더 또는 body에서)
        customerID := extractCustomerID(entry)

        // DB에 삽입
        logEntry := &store.RequestLog{
            AgentID:      agent.ID,
            RequestID:    entry.RequestID,
            Method:       entry.Method,
            Path:         entry.Path,
            StatusCode:   entry.StatusCode,
            ResponseMS:   entry.ResponseMS,
            CustomerID:   customerID,
            ToolName:     entry.ToolName,
            Timestamp:    timestamp,
            // ...
        }

        h.store.InsertRequestLog(ctx, logEntry)
    }

    // 3. 실시간 집계 업데이트
    h.updateAggregates(agent.ID)
}
```

### 5. 데이터베이스 저장

```sql
-- request_logs 테이블에 저장
INSERT INTO request_logs (
    agent_id,
    request_id,
    method,
    path,
    status_code,
    response_ms,
    customer_id,
    tool_name,
    timestamp,
    request_body,
    response_body,
    x402_amount,
    x402_tx_hash
) VALUES ($1, $2, ...);

-- 에이전트 통계 실시간 업데이트
UPDATE agents
SET
    total_requests = total_requests + 1,
    avg_response_ms = (avg_response_ms * total_requests + $response_ms) / (total_requests + 1)
WHERE id = $agent_id;
```

## 대시보드에서 확인

저장된 데이터는 대시보드에서 실시간으로 확인 가능:

1. **Overview**: 총 요청 수, 평균 응답 시간, 수익
2. **Analytics**: 일별 요청 추이 차트
3. **Customers**: 고객별 사용 내역
4. **Observability**: 최근 로그 스트림
5. **Speed Insights**: 응답 시간 분포

## 설정 옵션

### GT8004Logger 파라미터

```python
logger = GT8004Logger(
    agent_id="your-agent-id",           # 필수: 에이전트 ID
    api_key="your-api-key",             # 필수: API 키
    ingest_url="http://localhost:9092/v1/ingest",  # Ingest API URL
    batch_size=50,                      # 배치 크기 (기본: 50)
    flush_interval=5.0,                 # Flush 간격 초 (기본: 5.0)
)
```

### 환경별 설정 예시

**개발 환경:**
```python
logger = GT8004Logger(
    agent_id=os.getenv("GT8004_AGENT_ID"),
    api_key=os.getenv("GT8004_API_KEY"),
    ingest_url="http://localhost:9092/v1/ingest",
    batch_size=10,      # 작은 배치로 빠른 피드백
    flush_interval=2.0  # 2초마다 전송
)
```

**프로덕션 환경:**
```python
logger = GT8004Logger(
    agent_id=os.getenv("GT8004_AGENT_ID"),
    api_key=os.getenv("GT8004_API_KEY"),
    ingest_url="https://gt8004.xyz/v1/ingest",
    batch_size=100,     # 큰 배치로 효율성 향상
    flush_interval=10.0 # 10초마다 전송
)
```

## 에러 처리

SDK는 다음과 같은 상황을 자동으로 처리합니다:

### 1. 네트워크 에러
```python
# 자동 재시도 (exponential backoff)
# 실패 시 큐에 다시 넣어서 데이터 손실 방지
```

### 2. Circuit Breaker
```python
# 연속 3회 실패 시 일시적으로 전송 중단
# 서버 과부하 방지
```

### 3. Graceful Shutdown
```python
@app.on_event("shutdown")
async def shutdown():
    # 남은 로그 모두 전송
    await logger.close()
```

## 모범 사례

### 1. 민감한 데이터 마스킹

```python
from gt8004.middleware.fastapi import GT8004Middleware

# 커스텀 마스킹 함수
def mask_sensitive_data(body: str) -> str:
    # 비밀번호, 카드번호 등 마스킹
    return body.replace('"password":".*?"', '"password":"***"')

# 미들웨어에 적용
app.add_middleware(
    GT8004Middleware,
    logger=logger,
    sanitize_fn=mask_sensitive_data
)
```

### 2. 고객 ID 추적

```python
# 헤더에서 자동 추출
# X-Customer-ID: customer-123
# 또는 Authorization: Bearer {token} 파싱

# 또는 수동 설정
entry.customer_id = extract_customer_from_jwt(token)
```

### 3. X-402 결제 통합

```python
# X-402 프로토콜 결제 정보 기록
entry.x402_amount = 0.05          # USDC
entry.x402_tx_hash = "0xabc..."   # 온체인 트랜잭션
```

## 트러블슈팅

### Q: 로그가 대시보드에 안 보여요
A: 다음을 확인하세요:
1. API Key가 올바른지
2. Ingest URL이 정확한지 (http://localhost:9092/v1/ingest)
3. Analytics 서비스가 실행 중인지
4. `await logger.flush()` 호출 여부

### Q: 성능 영향이 있나요?
A: 최소한의 영향만 있습니다:
- 비동기 전송으로 메인 로직 블로킹 없음
- 배치 처리로 네트워크 오버헤드 최소화
- 요청당 약 1-2ms 오버헤드

### Q: 오프라인에서도 동작하나요?
A: 네, Circuit Breaker가 실패를 감지하고:
- 로그를 메모리에 계속 저장
- 서비스 복구 시 자동으로 재전송

## 예제 코드

전체 예제는 GitHub 저장소를 참고하세요:

**공식 SDK 저장소**: https://github.com/HydroX-labs/gt8004-sdk

- `examples/fastapi_example.py`: FastAPI 통합 예제
- `examples/manual_logging.py`: 수동 로깅 예제 (고급)

## 지원

- **GitHub**: https://github.com/HydroX-labs/gt8004-sdk
- **대시보드**: https://gt8004.xyz
- **Issues**: https://github.com/HydroX-labs/gt8004-sdk/issues
