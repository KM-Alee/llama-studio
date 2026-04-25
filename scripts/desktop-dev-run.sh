#!/usr/bin/env bash
# Build the native desktop app without bundling AppImage/deb/rpm, then start it.
# Much faster than a full `pnpm tauri build` when you only need to test locally.
#
# Usage (from repo root):
#   ./scripts/desktop-dev-run.sh              # frontend (vite) + Rust release, then run
#   ./scripts/desktop-dev-run.sh --rust-only  # only `cargo build` (use after Rust-only edits)
#
# Equivalent from src-frontend:
#   pnpm tauri:run
#
# For hot reload during UI work, use: cd src-frontend && pnpm tauri:dev

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/src-frontend"
BIN="$FRONTEND/src-tauri/target/release/llamastudio-desktop"

cd "$FRONTEND"

if [[ "${1:-}" == "--rust-only" ]]; then
  shift
  (cd src-tauri && cargo build --release)
else
  pnpm exec tauri build --no-bundle
fi

exec "$BIN" "$@"
