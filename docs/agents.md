# GT8004 Python Agents

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 개요

GT8004 Python 에이전트는 A2A (Agent-to-Agent) 프로토콜을 지원하는 LLM 기반 에이전트이다. Google AI Studio (Gemini)를 백엔드로 사용하며, FastAPI로 A2A 엔드포인트를 제공한다.

---

## Agent 목록

### companion-agent

기본 A2A 에이전트. GT8004 플랫폼 연동 없이 독립 실행.

**기술 스택:** FastAPI + Google AI Studio (Gemini 2.0 Flash)

**설정 (app/config.py):**

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `port` | int | 8080 | 서버 포트 |
| `google_api_key` | str | (필수) | Google AI Studio API 키 |
| `llm_model` | str | gemini-2.0-flash | LLM 모델 |
| `agent_name` | str | Companion Agent | 에이전트 이름 |
| `agent_description` | str | (설명) | 에이전트 설명 |
| `agent_version` | str | 1.0.0 | 버전 |
| `agent_url` | str | (옵션) | 에이전트 URL |
| `log_level` | str | info | 로깅 레벨 |

**API 라우트:**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 체크 (status, agent name, llm_model) |
| GET | `/.well-known/agent.json` | A2A 에이전트 카드 (스킬 포함) |
| POST | `/a2a/tasks/send` | 태스크 제출 (스킬 자동 감지) |
| GET | `/a2a/tasks/{task_id}` | 태스크 상태 조회 |
| POST | `/a2a/{skill_id}` | 스킬 직접 호출 |

**스킬:**

| Skill ID | 이름 | 설명 |
|----------|------|------|
| `chat` | General Chat | 일반 대화 및 Q&A |
| `summarize` | Summarize | 텍스트/문서 요약 |
| `translate` | Translate | 언어 번역 |
| `code-assist` | Code Assist | 코드 도움 및 디버깅 |

---

### friend-agent

GT8004 플랫폼 연동 에이전트. companion-agent와 동일한 A2A 기능에 GT8004 SDK 통합 추가.

**기술 스택:** FastAPI + Google AI Studio (Gemini 2.0 Flash) + GT8004 Python SDK

**추가 설정 (companion-agent 설정 외):**

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `provider_org` | str | '' | 제공자 조직명 |
| `provider_url` | str | '' | 제공자 URL |
| `gt8004_agent_id` | str | '' | GT8004 에이전트 ID |
| `gt8004_api_key` | str | '' | GT8004 API 키 |
| `gt8004_ingest_url` | str | https://ingest.gt8004.xyz/v1/ingest | 수집 엔드포인트 |

**GT8004 통합:**
- `gt8004_agent_id` + `gt8004_api_key`가 설정되면 GT8004Logger 초기화
- GT8004Middleware를 FastAPI 앱에 추가 (자동 요청 로깅)
- 시작 시 자동 플러시 + 연결 확인
- 종료 시 graceful 플러시

**A2A 에이전트 카드 확장:**
- 스킬에 태그 추가 (conversation, nlp, qa, summarization, translation, multilingual, coding, development, debugging)
- AgentProvider 필드 (organization, url)
- Authentication 필드 (schemes 배열)

---

## ERC-8004 등록

각 에이전트의 `erc8004/mint.py`에서 온체인 토큰 민팅 수행.

### 민팅 프로세스

1. `.env`에서 설정 로드:
   - `EVM_PRIVATE_KEY` — 지갑 개인키
   - `AGENT_NAME` — 에이전트 이름
   - `AGENT_DESCRIPTION` — 에이전트 설명
   - `AGENT_VERSION` — 에이전트 버전
   - `BASE_SEPOLIA_RPC` — RPC 엔드포인트
   - `IDENTITY_REGISTRY` — 레지스트리 주소

2. Base Sepolia (chainId: 84532) 연결

3. 기본 레지스트리: `0x8004A818BFB912233c491871b3d84c89A494BD9e`

4. 에이전트 URI 빌드 (base64 인코딩 JSON data URI):
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Agent Name",
  "description": "...",
  "version": "1.0.0",
  "services": [],
  "active": true
}
```

5. 지갑 잔액 확인 (가스비 필요)

6. `register(agentUri)` 컨트랙트 함수 호출

7. `AgentRegistered` 이벤트 파싱 → tokenId 추출

8. 결과 출력: 토큰 ID, 트랜잭션 해시, 블록 번호, 탐색기 링크

9. GT8004 플랫폼 등록은 `register/register.py`로 별도 수행

### 사용된 컨트랙트 ABI

```python
register(agentURI: string) → uint256  # 토큰 민팅
AgentRegistered(uint256 indexed tokenId, address indexed wallet, string agentURI)  # 이벤트
```

---

## 의존성

### companion-agent (`requirements.txt`)

| 패키지 | 버전 |
|--------|------|
| fastapi | >= 0.109.0 |
| uvicorn[standard] | >= 0.27.0 |
| pydantic | >= 2.0.0 |
| pydantic-settings | >= 2.0.0 |
| google-generativeai | >= 0.8.0 |
| httpx | >= 0.27.0 |

### friend-agent (`requirements.txt`)

companion-agent 의존성 전부 + :

| 패키지 | 소스 |
|--------|------|
| gt8004-sdk | GitHub: vataops/gt8004-sdk |

---

## 실행 방법

### Docker (권장)

```bash
# companion-agent
cd agents/companion-agent
docker build -t companion-agent .
docker run -p 8080:8080 -e GOOGLE_API_KEY=... companion-agent

# friend-agent
cd agents/friend-agent
docker build -t friend-agent .
docker run -p 8080:8080 \
  -e GOOGLE_API_KEY=... \
  -e GT8004_AGENT_ID=... \
  -e GT8004_API_KEY=... \
  friend-agent
```

**Dockerfile 공통:** Python 3.12-slim 기반, Uvicorn 실행

### 직접 실행

```bash
cd agents/companion-agent
pip install -r requirements.txt
GOOGLE_API_KEY=... uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### ERC-8004 토큰 민팅

```bash
cd agents/companion-agent/erc8004
# .env 파일 설정 (EVM_PRIVATE_KEY 등)
python mint.py
```
