.PHONY: dev dev-backend dev-frontend build clean check test fmt lint

# Start both backend and frontend in development mode
dev:
	@echo "Starting AI Studio development servers..."
	@trap 'kill 0' INT TERM; make dev-backend & make dev-frontend & wait

dev-backend:
	cd src-backend && RUST_LOG=debug cargo run

dev-frontend:
	cd src-frontend && pnpm dev

# Build for production
build: build-frontend build-backend

build-frontend:
	cd src-frontend && pnpm build

build-backend:
	cd src-backend && cargo build --release

# Type checking & linting
check:
	cd src-backend && cargo check
	cd src-backend && cargo clippy -- -D warnings
	cd src-frontend && pnpm tsc --noEmit
	cd src-frontend && pnpm lint

# Run all tests
test: test-backend

# Run backend tests
test-backend:
	cd src-backend && cargo test

# Format code
fmt:
	cd src-backend && cargo fmt
	cd src-frontend && pnpm exec prettier --write "src/**/*.{ts,tsx}"

# Lint only (no type check)
lint:
	cd src-backend && cargo clippy -- -D warnings
	cd src-frontend && pnpm lint

# Clean build artifacts
clean:
	cd src-backend && cargo clean
	cd src-frontend && rm -rf dist node_modules/.vite
