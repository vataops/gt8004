# Rebuild Backend

GT8004 unified 백엔드를 리빌드하고 재시작합니다.

1. Go 빌드 검증 (로컬):
```bash
cd /Users/vata/AEL/services/unified/backend && go build ./cmd/gt8004d/
```

2. Docker 리빌드 + 재시작:
```bash
cd /Users/vata/AEL && docker compose build gt8004-backend && docker compose up -d gt8004-backend
```

3. 로그 확인:
```bash
cd /Users/vata/AEL && docker compose logs -f gt8004-backend
```

빌드 실패 시 에러를 분석하고 수정한 후 다시 시도합니다.
