.PHONY: build run test clean docker-up docker-down

# ── Build ───────────────────────────────────────
build:
	cd backend && go build -o bin/aesd ./cmd/aesd

run: build
	cd backend && ./bin/aesd

test:
	cd backend && go test ./...

clean:
	rm -rf backend/bin

# ── Docker ──────────────────────────────────────
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f

# ── Dashboard ───────────────────────────────────
dashboard-dev:
	cd dashboard && npm run dev

dashboard-build:
	cd dashboard && npm run build

# ── Contracts ───────────────────────────────────
aiken-build:
	cd ../contracts/credit && aiken build

aiken-check:
	cd ../contracts/credit && aiken check

forge-build:
	cd ../contracts/escrow && forge build

forge-test:
	cd ../contracts/escrow && forge test
