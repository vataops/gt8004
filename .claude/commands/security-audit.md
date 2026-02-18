---
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git ls-files:*), Bash(git ls-tree:*), Bash(git show:*), Bash(git grep:*), Bash(git status:*), Grep, Glob, Read
description: Scan for leaked secrets, keys, and sensitive files in git history and working tree
---

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status --short`

## Your task

Git 리포지토리에서 보안 민감 정보가 노출되었거나 노출 위험이 있는지 종합 감사를 수행하라.

### 1. 커밋 히스토리에 이미 올라간 민감 파일 검사

아래 패턴에 해당하는 파일이 git 히스토리(전체)에 존재하는지 확인:

```
git log --all --diff-filter=A --name-only --pretty=format: -- \
  '*.env' '*.env.*' '*.pem' '*.key' '*.p12' '*.pfx' '*.jks' \
  '*.sk' '*.skey' '*.vkey' '*.signing_key' '**/key.json' \
  '*.tfvars' '*.tfstate' '*.tfstate.backup' \
  '*credentials*' '*secret*' '*.keystore' \
  '*service-account*.json' '*sa-key*.json' \
  '**/.gcp/' '**/gcloud/' | sort -u
```

### 2. 현재 트래킹 중인 파일에서 민감 파일 검사

```
git ls-files
```

위 결과에서 아래 패턴과 매칭되는 파일이 있는지 확인:
- `.env`, `.env.*` (단 `.env.example`, `.env.sample` 제외)
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`
- `*.sk`, `*.skey`, `*.vkey`, `*.signing_key`
- `key.json`, `credentials.json`, `service-account*.json`
- `*.tfvars` (단 `*.tfvars.example` 제외)
- `*.tfstate`, `*.tfstate.backup`
- `id_rsa`, `id_ed25519`, `id_ecdsa` (SSH 키)

### 3. 소스 코드 내 하드코딩된 시크릿 패턴 검사

트래킹 중인 소스 파일(`.go`, `.ts`, `.tsx`, `.js`, `.py`, `.yaml`, `.yml`, `.json`, `.toml`)에서 아래 패턴을 `git grep` 또는 Grep으로 검색:

- API 키: `(?i)(api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']`
- AWS 키: `AKIA[0-9A-Z]{16}`
- GCP 서비스 계정: `"type"\s*:\s*"service_account"`
- Private 키 헤더: `-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----`
- JWT/토큰: `(?i)(token|secret|password|passwd|jwt)\s*[:=]\s*["'][A-Za-z0-9_\-\.]{20,}["']`
- Base64 인코딩 키: `(?i)(private[_-]?key|secret[_-]?key)\s*[:=]\s*["'][A-Za-z0-9+/=]{40,}["']`
- Hex 개인키: `(?i)(private[_-]?key|signing[_-]?key)\s*[:=]\s*["']0x[0-9a-fA-F]{64}["']`
- Mnemonic seed: `(?i)mnemonic\s*[:=]\s*["'](\w+\s+){11,}\w+["']`
- 하드코딩된 DB password: `(?i)(dsn|database_url|connection_string).*password`

**주의**: `.env.example`, `*.test.*`, `*_test.go`, `*.spec.*`, `docs/`, `CLAUDE.md`, `.claude/` 파일은 false positive가 많으므로 결과에서 별도 표시하라.

### 4. .gitignore 누락 패턴 확인

현재 `.gitignore`에 아래 필수 패턴이 포함되어 있는지 확인:

- `.env` 관련: `.env`, `.env.local`, `.env.*.local`
- 키 파일: `*.pem`, `*.key`, `*.p12`
- Terraform: `*.tfvars`, `*.tfstate`
- 크립토 키: `*.sk`, `*.skey`, `*.vkey`
- SSH 키: `id_rsa`, `id_ed25519`
- GCP: `**/key.json`

누락된 패턴이 있으면 추가 권장 목록을 제시하라.

### 5. Staged 변경사항 검사 (커밋 전 체크)

현재 staged된 파일이 있다면 그 안에 민감 정보가 포함되어 있는지도 검사:

```
git diff --cached --name-only
```

### 결과 보고 형식

결과를 아래 형식으로 정리하라:

```
## 🔒 보안 감사 결과

### 위험 (즉시 조치 필요)
- [파일 경로] — 설명

### 경고 (확인 필요)
- [파일 경로:라인] — 설명

### .gitignore 개선 권장
- 추가할 패턴 목록

### ✅ 통과 항목
- 검사 완료된 항목 요약
```

위험 항목이 발견되면 구체적인 조치 방법(git filter-branch, BFG Repo-Cleaner 등)도 안내하라.