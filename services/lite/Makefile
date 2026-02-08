.PHONY: all build run test clean migrate docker-up docker-down

# ── Build ────────────────────────────────────────
all: build

build:
	cd backend && go build -o aesd ./cmd/aesd

run: build
	cd backend && ./aesd

test:
	cd backend && go test ./...

clean:
	rm -f backend/aesd

# ── Database ─────────────────────────────────────
migrate:
	@echo "Running migrations..."
	@for f in backend/internal/store/migrations/*.sql; do \
		echo "  Applying $$f"; \
		PGPASSWORD=aes psql -h localhost -U aes -d aes -f "$$f"; \
	done
	@echo "Migrations complete."

# ── Docker ───────────────────────────────────────
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f backend

# ── Dashboard ────────────────────────────────────
dashboard-dev:
	cd dashboard && npm run dev

dashboard-build:
	cd dashboard && npm run build

# ── Contracts (shared, at repo root) ─────────────
forge-build:
	cd ../contracts/escrow && forge build

forge-test:
	cd ../contracts/escrow && forge test

# ── All Tests ────────────────────────────────────
test-all: test forge-test
	@echo "All tests passed."
