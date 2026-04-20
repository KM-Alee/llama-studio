.PHONY: install \
	dev dev-backend dev-frontend dev-desktop \
	check check-backend check-frontend check-desktop \
	lint lint-backend lint-frontend lint-desktop \
	test test-backend test-frontend \
	fmt fmt-backend fmt-frontend fmt-desktop \
	build build-backend build-frontend build-desktop \
	release release-desktop release-all clean

BACKEND_DIR := src-backend
FRONTEND_DIR := src-frontend
TAURI_DIR := $(FRONTEND_DIR)/src-tauri

install:
	cd $(FRONTEND_DIR) && pnpm install

dev:
	@echo "Starting AI Studio browser development servers..."
	@trap 'kill 0' INT TERM; $(MAKE) dev-backend & $(MAKE) dev-frontend & wait

dev-backend:
	cd $(BACKEND_DIR) && RUST_LOG=debug cargo run

dev-frontend:
	cd $(FRONTEND_DIR) && pnpm dev

dev-desktop:
	cd $(FRONTEND_DIR) && pnpm tauri:dev

build: build-frontend build-backend

build-frontend:
	cd $(FRONTEND_DIR) && pnpm build

build-backend:
	cd $(BACKEND_DIR) && cargo build --release

build-desktop:
	cd $(FRONTEND_DIR) && pnpm tauri:build

check: check-backend check-frontend check-desktop

check-backend:
	cd $(BACKEND_DIR) && cargo check

check-frontend:
	cd $(FRONTEND_DIR) && pnpm tsc --noEmit
	cd $(FRONTEND_DIR) && pnpm lint

check-desktop:
	cd $(TAURI_DIR) && cargo check

lint: lint-backend lint-frontend lint-desktop

lint-backend:
	cd $(BACKEND_DIR) && cargo clippy -- -D warnings

lint-frontend:
	cd $(FRONTEND_DIR) && pnpm lint

lint-desktop:
	cd $(TAURI_DIR) && cargo clippy -- -D warnings

test: test-backend test-frontend

test-backend:
	cd $(BACKEND_DIR) && cargo test

test-frontend:
	cd $(FRONTEND_DIR) && pnpm test

fmt: fmt-backend fmt-frontend fmt-desktop

fmt-backend:
	cd $(BACKEND_DIR) && cargo fmt

fmt-frontend:
	cd $(FRONTEND_DIR) && pnpm exec prettier --write "src/**/*.{ts,tsx}" "vite.config.ts" "src-tauri/**/*.json" "../README.md" "../CONTRIBUTING.md" "../docs/**/*.md"

fmt-desktop:
	cd $(TAURI_DIR) && cargo fmt

release: check lint test build

release-desktop: check lint test build-desktop

release-all: release release-desktop

clean:
	cd $(BACKEND_DIR) && cargo clean
	cd $(TAURI_DIR) && cargo clean
	cd $(FRONTEND_DIR) && rm -rf dist node_modules/.vite
