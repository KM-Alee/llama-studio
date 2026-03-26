.PHONY: dev dev-backend dev-frontend build clean check

# Start both backend and frontend in development mode
dev:
	@echo "Starting AI Studio development servers..."
	@make dev-backend & make dev-frontend

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
	cd src-frontend && pnpm tsc --noEmit

# Clean build artifacts
clean:
	cd src-backend && cargo clean
	cd src-frontend && rm -rf dist node_modules/.vite

# Run backend tests
test-backend:
	cd src-backend && cargo test

# Format code
fmt:
	cd src-backend && cargo fmt
	cd src-frontend && pnpm exec prettier --write "src/**/*.{ts,tsx}"
