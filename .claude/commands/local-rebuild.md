---
allowed-tools: Bash(docker compose:*), Bash(docker:*)
argument-hint: [service-name: registry|analytics|discovery|gateway|all]
description: Rebuild Backend
---

## Context

- Docker Compose file: `services/docker-compose.yml`
- Project name: `gt8004` (COMPOSE_PROJECT_NAME=gt8004)
- Backend services: registry, analytics, discovery, gateway
- Infrastructure (redis, postgres, nginx): NOT rebuilt

## Your task

Rebuild and restart backend service(s) without touching infrastructure (redis, postgres).

1. Determine which service(s) to rebuild:
   - If `$ARGUMENTS` is provided, rebuild only that service (e.g., `registry`, `analytics`, `discovery`, `gateway`)
   - If `$ARGUMENTS` is `all` or empty, rebuild all 4 backend services
2. Run from `services/` directory with project name `gt8004`:
   ```
   cd services && COMPOSE_PROJECT_NAME=gt8004 docker compose up -d --build --no-deps <service-name(s)>
   ```
   - `COMPOSE_PROJECT_NAME=gt8004` ensures containers match the existing `gt8004-*` infrastructure
   - `--build` forces image rebuild
   - `--no-deps` skips recreating infrastructure dependencies (redis, postgres)
   - `-d` runs in detached mode
3. Reload nginx so it picks up new container IPs:
   ```
   docker exec gt8004-nginx-1 nginx -s reload
   ```
4. After rebuild, show logs for the rebuilt service(s):
   ```
   COMPOSE_PROJECT_NAME=gt8004 docker compose logs --tail=20 <service-name(s)>
   ```
5. Report which service(s) were rebuilt and their status.

### Service map
| Service    | Dockerfile                              | Port  |
|------------|-----------------------------------------|-------|
| registry   | services/registry/backend/Dockerfile    | 9091  |
| analytics  | services/analytics/Dockerfile           | 9092  |
| discovery  | services/discovery/Dockerfile           | 9093  |
| gateway    | services/gateway/Dockerfile             | 9094  |