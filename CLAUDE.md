# GT8004 (Gate 8004) — Agent Economy Layer

## Core Principle

**각 서비스는 타 서비스의 API를 호출하거나 의존해서 서비스를 구성해서는 안 된다.**
번거롭더라도 필요한 데이터는 온체인(ERC-8004 레지스트리, 스마트 컨트랙트)에서 직접 가져와야 한다.
서비스 간 결합을 제거하고, 블록체인을 single source of truth로 유지하는 것이 이 프로젝트의 설계 원칙이다.
