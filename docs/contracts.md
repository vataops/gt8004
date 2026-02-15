# GT8004 Contracts

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 개요

GT8004는 ERC-8004 표준 기반의 AI 에이전트 신원 관리 시스템이다. Solidity 소스 파일은 현재 레포지토리에 포함되지 않으며, ABI는 Go 서비스의 `erc8004/` 패키지와 대시보드의 `erc8004.ts`에서 추출했다.

---

## ERC-8004 Identity Registry

에이전트 등록, URI 관리, 소유권 조회를 위한 핵심 컨트랙트. ERC-721 호환.

### 함수

| 함수 | 파라미터 | 반환 | 설명 |
|------|---------|------|------|
| `register` | `string agentURI` | `uint256 tokenId` | 새 에이전트 토큰 민팅 |
| `setAgentURI` | `uint256 tokenId, string uri` | — | 에이전트 메타데이터 URI 갱신 |
| `getAgentURI` | `uint256 tokenId` | `string` | 에이전트 메타데이터 URI 조회 |
| `ownerOf` | `uint256 tokenId` | `address` | 토큰 소유자 조회 (ERC-721) |
| `balanceOf` | `address owner` | `uint256` | 소유 토큰 수 조회 (ERC-721) |
| `tokenOfOwnerByIndex` | `address owner, uint256 index` | `uint256` | 소유자의 N번째 토큰 ID (ERC-721 Enumerable) |

### 이벤트

| 이벤트 | 파라미터 | 설명 |
|--------|---------|------|
| `AgentRegistered` | `uint256 indexed tokenId, address indexed wallet, string agentURI` | 새 에이전트 등록 시 발생 |
| `Transfer` | `address indexed from, address indexed to, uint256 indexed tokenId` | 토큰 전송 (ERC-721 표준) |

### Agent URI 메타데이터 형식

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Agent Name",
  "description": "Agent description",
  "image": "https://... or ipfs://...",
  "version": "1.0.0",
  "services": [
    {
      "name": "mcp",
      "endpoint": "https://example.com/mcp",
      "mcpTools": ["tool1", "tool2"],
      "mcpPrompts": [],
      "mcpResources": []
    },
    {
      "name": "a2a",
      "endpoint": "https://example.com/a2a"
    },
    {
      "name": "oasf",
      "skills": ["Text Generation", "Code Generation"],
      "domains": ["Artificial Intelligence"]
    }
  ],
  "active": true,
  "x402Support": true,
  "supportedTrust": ["reputation", "crypto-economic", "tee"]
}
```

**인코딩:** `data:application/json;base64,{base64 encoded JSON}`

### 배포 정보

| 네트워크 | Chain ID | Registry 주소 |
|---------|----------|--------------|
| Base Sepolia | 84532 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Ethereum Sepolia | 11155111 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

---

## Reputation Registry

온체인 리퓨테이션 관리 컨트랙트. Base Sepolia에만 배포.

### 함수

| 함수 | 파라미터 | 반환 | 설명 |
|------|---------|------|------|
| `getReputationScore` | `uint256 tokenId` | `uint256` | 리퓨테이션 점수 조회 |
| `submitFeedback` | `uint256 tokenId, uint8 score, string comment` | — | 피드백 제출 |
| `getFeedbackCount` | `uint256 tokenId` | `uint256` | 피드백 수 조회 |

### 이벤트

| 이벤트 | 파라미터 | 설명 |
|--------|---------|------|
| `FeedbackSubmitted` | `uint256 indexed tokenId, address indexed reviewer, uint8 score` | 피드백 제출 시 발생 |

### 배포 정보

| 네트워크 | Chain ID | Reputation 주소 |
|---------|----------|-----------------|
| Base Sepolia | 84532 | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Ethereum Sepolia | 11155111 | 해당 없음 |

---

## Identity Registry (별도 주소)

Registry 서비스의 Identity Verifier가 사용하는 별도 컨트랙트.

| 네트워크 | 주소 | RPC |
|---------|------|-----|
| Base Sepolia | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | https://sepolia.base.org |

---

## Escrow

`contracts/escrow/` 디렉토리 존재. Solidity 파일 미확인.

**상태:** 미구현 또는 별도 관리

## Credit

`contracts/credit/` 디렉토리 존재. Solidity 파일 미확인.

**상태:** 미구현 또는 별도 관리
