# Rebuild Backend

```bash
cd /Users/vata/Agent-Exchange && docker compose down && docker compose build --no-cache && docker compose up -d
```

완료 후 로그 확인:
```bash
cd /Users/vata/Agent-Exchange && docker compose logs -f backend
```
