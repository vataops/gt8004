# GT8004 Dashboard

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 개요

GT8004 대시보드는 ERC-8004 AI 에이전트의 등록, 모니터링, 분석을 위한 웹 인터페이스다. Next.js App Router 기반으로 에이전트 생성 위저드, 분석 대시보드, 온체인 탐색 등을 제공한다.

## 기술 스택

| 패키지 | 버전 |
|--------|------|
| Next.js | 16.1.6 |
| React | 19.2.3 |
| Tailwind CSS | 4.x |
| ethers.js | 6.16.0 |
| Recharts | 3.7.0 |
| TypeScript | 5.x |

**Docker**: node:22-alpine, 포트 3000

**환경 변수**:
- `NEXT_PUBLIC_OPEN_API_URL` — Open API 서버 URL (기본: http://localhost:8080)
- `NEXT_PUBLIC_LITE_API_URL` — Lite API 서버 URL (기본: http://localhost:8081)

## 페이지 목록

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | page.tsx | 에이전트 탐색기 (메인 페이지) |
| `/agents/[id]` | page.tsx | 에이전트 상세 정보 |
| `/benchmark` | page.tsx | 에이전트 벤치마크/랭킹 |
| `/create` | page.tsx | 에이전트 생성 위저드 (7단계) |
| `/customers` | page.tsx | 고객 분석 (인증 필요) |
| `/discovery` | page.tsx | 온체인 에이전트 탐색 |
| `/discovery/[chain]/[tokenId]` | page.tsx | 특정 온체인 에이전트 상세 |
| `/login` | page.tsx | API 키 로그인 |
| `/logs` | page.tsx | 요청 로그 뷰어 |
| `/my-agents` | page.tsx | 인증된 소유자 대시보드 |
| `/performance` | page.tsx | 성능 메트릭 대시보드 |
| `/register` | page.tsx | 에이전트 GT8004 등록 (2단계) |
| `/revenue` | page.tsx | 매출 분석 |
| `/settings` | page.tsx | 에이전트 설정 |

## Create Agent 위저드

`/create` 페이지에서 7단계 위저드로 ERC-8004 에이전트 토큰을 온체인에 민팅한다.

| Step | 컴포넌트 | 설명 |
|------|---------|------|
| 1 | StepBasicInfo | 에이전트 이름 (필수, 100자), 설명 (필수, 50~2000자), 이미지 URL (옵션) |
| 2 | StepServices | MCP/A2A/OASF/Custom 서비스 엔드포인트 추가 (옵션) |
| 3 | StepCapabilities | OASF 스킬 + 도메인 다중 선택 (옵션) |
| 4 | StepAdvanced | 신뢰 메커니즘, 활성 상태, x402 결제 지원 (옵션) |
| 5 | StepUri | 메타데이터 저장 방식 (Data URI / IPFS), JSON 미리보기 + 다운로드 |
| 6 | StepNetworks | 배포할 블록체인 네트워크 선택 (1개 이상 필수) |
| 7 | StepReview | 전체 리뷰 + 지갑 연결 + 온체인 민팅 |

**WizardState**: 단일 useState 객체로 관리, Context 없음.

## 라이브러리 (src/lib/)

### api.ts

API 클라이언트. `openApi` 객체로 모든 백엔드 API를 호출한다.

**Public (인증 불필요):**
- `getOverview()` — 대시보드 개요
- `searchAgents(category?)` / `searchAgentsAdvanced(params)` — 에이전트 검색
- `getBenchmarkCategories()` / `getBenchmark(category)` — 벤치마크
- `getChallenge(agentId)` / `verifySignature(...)` / `walletLogin(...)` — 인증
- `verifyToken(tokenId)` / `listTokensByOwner(address, chainId?)` — ERC-8004
- `getWalletAgents(address)` / `getWalletStats(address)` — 지갑
- `getNetworkAgents(params)` / `getNetworkAgent(chainId, tokenId)` / `getNetworkStats()` — 온체인 탐색
- `getReputationSummary(tokenId)` / `getReputationFeedbacks(tokenId)` — 리퓨테이션

**에이전트 분석:**
- `getStats(agentId)` / `getDailyStats(agentId, days)` — 통계
- `getCustomers(agentId)` / `getCustomer(agentId, customerId)` — 고객
- `getRevenue(agentId, period)` — 매출
- `getPerformance(agentId, window)` — 성능
- `getLogs(agentId, limit)` — 로그
- `getAnalytics(agentId, days)` — 종합 분석
- `getFunnel(agentId, days)` — 전환 퍼널

**에이전트 관리:**
- `registerAgent(req)` — 등록
- `linkERC8004(agentId, apiKey, body)` — ERC-8004 연결
- `enableGateway(agentId, auth)` / `disableGateway(agentId, auth)` — 게이트웨이
- `regenerateAPIKey(agentId, auth)` — API 키 재발급
- `deregisterAgent(agentId, auth)` — 등록 해제

**주요 TypeScript 인터페이스:**
`Agent`, `RegisterRequest`, `RegisterResponse`, `Overview`, `Customer`, `RevenueReport`, `PerformanceReport`, `BenchmarkEntry`, `RequestLog`, `AgentStats`, `AnalyticsReport`, `FunnelReport`, `ReputationSummary`, `NetworkAgent`, `NetworkStats`, `AgentMetadata`, `AgentService`

### auth.tsx

AuthContext 기반 인증 상태 관리.

**AuthState:**
- `apiKey` — 저장된 API 키
- `agent` — 인증된 에이전트 객체
- `walletAddress` — 연결된 지갑 주소
- `loading` — 초기화 상태

**메서드:**
- `login(key)` — API 키 로그인 (`/v1/agents/me` 호출)
- `walletLogin(key, agent, walletAddr)` — 지갑 기반 로그인
- `connectWallet(walletAddr)` — 지갑 연결 (로그인 없이)
- `logout()` — 상태 초기화

**localStorage 키:** `gt8004_api_key`, `gt8004_wallet_address`

### erc8004.ts

ERC-8004 컨트랙트 인터랙션 (ethers.js 6).

| 함수 | 설명 |
|------|------|
| `getTokensByOwner(rpcUrl, contractAddress, ownerAddress)` | ERC721Enumerable로 소유 토큰 조회 |
| `ensureChain(chainId)` | MetaMask 체인 전환/추가 |
| `registerNewAgent(chainId, agentUri)` | 새 ERC-8004 토큰 민팅 (`register()` 호출) |
| `updateAgentURI(chainId, tokenId, newUri)` | 에이전트 URI 갱신 (`setAgentURI()` 호출) |
| `decodeDataUri(uri)` | base64/JSON URI 디코딩 |
| `encodeDataUri(obj)` | 객체를 data URI로 인코딩 |
| `buildGatewayMetadata(currentUri, gatewayUrl)` | 메타데이터에 게이트웨이 엔드포인트 삽입 |
| `restoreOriginalMetadata(currentUri, originalEndpoint)` | 원본 엔드포인트 복원 |
| `buildA2AServiceMetadata(currentUri, a2aEndpoint)` | A2A 서비스 메타데이터 추가 |

### networks.ts

지원 네트워크 설정.

| 네트워크 | Chain ID | Registry 주소 | Reputation 주소 |
|---------|----------|--------------|----------------|
| Base Sepolia | 84532 | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 |
| Ethereum Sepolia | 11155111 | 0x8004A818BFB912233c491871b3d84c89A494BD9e | (없음) |

**유틸:**
- `resolveImageUrl(url)` — IPFS URI를 https://w3s.link/ipfs/ 게이트웨이로 변환
- `parseAgentURIImage(uri)` — 에이전트 URI에서 이미지 추출
- `NETWORK_LIST` — 전체 네트워크 배열

### wallet.ts

MetaMask 지갑 유틸리티.

| 함수 | 설명 |
|------|------|
| `hasWallet()` | `window.ethereum` 존재 여부 |
| `connectWallet()` | MetaMask 연결, signer 주소 반환 |
| `signChallenge(challengeHex)` | 챌린지 서명 |

### hooks.ts

자동 폴링 커스텀 훅 (SWR 패턴).

**Public (폴링 10~60초):**
`useOverview`, `useAgents`, `useDiscovery`, `useNetworkAgents`, `useNetworkAgent`, `useNetworkStats`, `useBenchmarkCategories`, `useBenchmark`

**에이전트 분석 (폴링 10~60초):**
`useAgentStats`, `useDailyStats`, `useCustomers`, `useRevenue`, `usePerformance`, `useLogs`, `useAnalytics`, `useFunnel`

**고객 상세:**
`useCustomerLogs`, `useCustomerTools`, `useCustomerDaily`

**지갑 분석:**
`useWalletStats`, `useWalletDailyStats`, `useWalletErrors`

### oasf-taxonomy.ts

OASF (Open Agentic Schema Framework) 스킬/도메인 분류 체계.

- **스킬 카테고리**: 10개 (NLP, Reasoning, Code, Data, Vision, Audio, Knowledge, Automation, Security, Creative)
- **총 스킬**: ~80개
- **도메인**: ~60개 (Technology, Business, Healthcare, Education, Finance 등)

## 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| Badge | 태그/라벨 뱃지 |
| CodeBlock | 코드 표시 |
| CopyButton | 클립보드 복사 버튼 |
| DataTable | 재사용 가능한 데이터 테이블 |
| HealthScoreCard | 헬스 스코어 시각화 카드 |
| ProtocolBreakdownCards | 프로토콜 통계 카드 |
| RequireAuth | 인증 보호 HOC |
| Sidebar | 네비게이션 사이드바 |
| StatCard | 일반 통계 카드 |
| StatCardWithTrend | 트렌드 표시 통계 카드 |
| ToolPerformanceTable | 도구별 성능 테이블 |
| TrendChart | Recharts 기반 트렌드 차트 |

## 인증 플로우

### API 키 로그인
1. `/login` 페이지에서 API 키 입력
2. `GET /v1/agents/me` (Authorization: Bearer {key}) 호출
3. 성공 시 `gt8004_api_key` localStorage 저장
4. AuthContext에 agent + apiKey 설정

### 지갑 로그인
1. MetaMask 연결 (`connectWallet()`)
2. `POST /v1/auth/wallet-login` (address, challenge, signature)
3. 서버가 서명 검증 후 API 키 반환
4. `gt8004_wallet_address` + `gt8004_api_key` localStorage 저장

### 사이드바 네비게이션
- **Public**: Explorer, Create Agent
- **인증 후**: Dashboard (my-agents)
- **미인증**: Register Agent, Login 버튼
