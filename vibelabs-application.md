# Hashed Vibe Labs 지원서

**Subject: [Vibe Labs 지원] GT8004 — AI 에이전트를 위한 온체인 분석 플랫폼**

---

## 팀 소개

**이진형** | 1인 풀타임

- Wemade 위믹스 디파이개발그룹 DevOps 엔지니어
  - Phinx 디파이 서비스 인프라 아키텍처 설계 및 운영
  - Arbitrum 및 OP Stack 레이어2 구축, 온보딩 테스트 진행
- DSRV (Validator / allthatnode) 블록체인 엔지니어
  - Geth 계열 및 Cosmos SDK 계열 Validator·RPC 노드 구축·운영
  - allthatnode 서비스 Kubernetes 마이그레이션
  - 마다가스카르 현지 L2 기반 농업 바우처 솔루션 인프라 담당
  - AI Agent를 활용한 노드 운영 업무 자동화

소셜: X [@gt8004xyz](https://x.com/gt8004xyz) | LinkedIn [TODO]

---

## 라이브 서비스

https://gt8004.xyz

---

## 프로젝트 소개

**GT8004 (Gate 8004)** — AI 에이전트 운영자를 위한 분석·관측 플랫폼

AI 에이전트가 실제 서비스로 배포되기 시작했지만, 운영자에게는 "내 에이전트가 얼마나 쓰이고 있는지", "수익이 발생하고 있는지", "성능에 문제는 없는지"를 파악할 수단이 없습니다. GT8004는 에이전트 운영에 필요한 분석 인프라를 온체인 아이덴티티와 함께 제공합니다.

### 주요 기능

**SDK 5줄 연동, 즉시 분석 대시보드 확보:**

- 요청량 분석 — 일별 추이, 프로토콜별·툴별 상세 분류
- 수익 분석 — x402 결제 매출 추적, 유료 전환율(Paid Conversion Funnel)
- 고객 분석 — 유니크 사용자 추적, 세그먼트별 이용 패턴
- Observability — 응답 속도(p50/p95/p99), 에러율, 업타임 모니터링

### 서비스 특징

- **ERC-8004 온체인 레지스트리** — 자체 설계한 AI 에이전트 ID 표준(ERC-721 확장). 에이전트 등록부터 메타데이터 관리까지 온체인으로 처리
- **멀티체인** — Ethereum, Base 메인넷 배포 완료. Polygon, BSC 등 확장 예정
- **멀티 프로토콜** — MCP(Claude), A2A(Agent-to-Agent), x402(결제) 동시 지원
- **에이전트 자율 등록** — 운영자 뿐 아니라 에이전트가 MCP를 통해 스스로 레지스트리에 등록 가능

### 기술 스택

- 백엔드: Go 마이크로서비스 5개 (Registry, Analytics, Discovery, Ingest, API Gateway)
- 프론트엔드: Next.js 16, React 19
- 컨트랙트: ERC-8004 Identity Registry + Reputation Registry
- SDK: Python (FastMCP, FastAPI, Flask 지원)
- 인프라: GCP Cloud Run, Cloud SQL, Terraform, GitHub Actions CI/CD

---

## 비즈니스 모델

1. **에이전트 인텔리전스** — 에이전트 활동 데이터를 기반으로 운영 최적화 인사이트 및 벤치마크 서비스 제공
2. **대량 요청 에스크로** — 기업·에이전트 간 대량 호출을 위한 사전 결제·정산 서비스
3. **서비스 토크노믹스** — GT8004 자체 에이전트를 Virtual Protocol에 배포, 토큰 발행을 통한 플랫폼 경제 구축

---

## GitHub

- 플랫폼: https://github.com/vataops/gt8004
- SDK: https://github.com/vataops/gt8004-sdk
