# Desktop-first architecture

LlamaStudio ships as a **native Tauri desktop application** on Linux, Windows, and macOS. This document locks the product boundary described in the native desktop migration.

## Canonical runtime (desktop)

- The **webview loads bundled frontend assets** from Tauri (`tauri://localhost` / asset protocol), not `http://127.0.0.1:<app_port>`.
- The **UI talks to Rust only** via Tauri **commands** (`invoke`) and **events** for streaming and background updates.
- There is **no user-facing HTTP server** for the desktop shell: the Axum stack is not started for normal desktop use.
- **SQLite** remains the source of truth for conversations, models registry, presets, and merged app configuration.
- **Browser `localStorage`** is not relied on for durable UI preferences on desktop; see `desktop_ui_state` in the database and the `get_ui_preferences` / `set_ui_preferences` commands.

## Optional HTTP runtime (standalone / dev)

The `llamastudio-backend` binary and integration tests may still use an Axum HTTP listener for API + SPA hosting. That path exists for development, automation, and power users; it is **not** the desktop product boundary.

- HTTP listen address: `127.0.0.1` on port from environment variable `LLAMASTUDIO_APP_PORT` (default `6868`) when the standalone server runs.
- The desktop app does not read or expose an `app_port` user setting.

## Real-time updates (desktop)

- Server status and log lines: Tauri events `server://status` and `server://log`.
- Chat completion streaming: command `start_chat_stream` returns a `request_id`; chunks arrive on `chat://chunk`, completion on `chat://done`, errors on `chat://error`.
- Download progress: event `downloads://progress` (mirrors `DownloadProgress` payloads).

## Installers

- **Linux**: `.deb`, `.rpm`, `.AppImage` from releases. `scripts/install-linux.sh` is the supported one-liner: it installs base packages (curl, FUSE, `jq` where available) for common distro families, picks the right asset, and for AppImage sets up `~/.local/bin/llamastudio`, a `.desktop` entry, and a menu icon from the repo. Optional: `bash -s -- --with-llama` pulls the latest official **CPU** `llama-…-bin-ubuntu-x64` build from ggerganov/llama.cpp and symlinks `llama-server` / `llama-cli` into `~/.local/bin` (GPU: install the matching release asset manually or use a distro package).
- **Windows**: NSIS and MSI. `nsis/installer-hooks.nsh` can prompt to open the official llama.cpp releases page; in-app, **Settings → Runtime Dependencies** is the check/setup surface. Tauri `bundle` icon + NSIS `installerIcon` are configured in `tauri.conf.json` / `tauri.windows.conf.json`.
- **macOS**: `.app` + `.dmg` in CI/release when signing secrets are configured.

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — overall stack overview (update as desktop becomes primary).
- [RELEASES.md](./RELEASES.md) — signing and updater secrets.
