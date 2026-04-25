# LlamaStudio Release Guide

## Release Artifacts

GitHub Actions publishes:

- Windows `.exe`
- Windows `.msi`
- Linux `.AppImage`
- Linux `.deb`
- Linux `.rpm`
- macOS `.dmg` / `.app` (matrix runner: Apple Silicon on `macos-14` unless extended)
- Extra CI artifacts: `llamastudio-tauri-bundle-<platform>.tgz`, `shasums-<platform>.txt`, standalone `llamastudio-backend-*` archives where configured

## Triggers

- **Tag push:** push a tag matching `v*` (for example `v0.1.0`). The workflow uses `github.ref_name` as the release tag.
- **Manual:** `workflow_dispatch` with required input **tag** (same `v*` form). That tag must **already exist** on the remote; the workflow checks it out before building.

## Pre-tag checklist (local)

From repo root:

```bash
cd src-backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test
cd src-frontend && pnpm install --frozen-lockfile && pnpm tsc --noEmit && pnpm lint && pnpm test
```

Optional smoke (Linux example):

```bash
cd src-frontend && CI=true NO_STRIP=1 pnpm exec tauri build --ci --no-sign -b deb -c '{"bundle":{"createUpdaterArtifacts":false}}'
```

Confirm `git status` has **no** stray release binaries under `src-backend/` (they are gitignored) and versions align: `src-frontend/package.json`, `src-frontend/src-tauri/Cargo.toml`, `src-frontend/src-tauri/tauri.conf.json`, and `src-backend/Cargo.toml` should match the tag you are about to publish.

## Update Delivery

The Tauri updater is configured to read:

- `https://github.com/KM-Alee/llama-studio/releases/latest/download/latest.json`

This requires release artifacts to be signed with the Tauri updater private key when you want in-app updates to work.

## Recommended Secrets

- `TAURI_SIGNING_PRIVATE_KEY` — private key used by CI to sign bundles / updater metadata.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password for that key, if set.
- `TAURI_UPDATER_PUBKEY` — **public** key; the Tauri bundler injects it at build time via the environment variable **`LLAMASTUDIO_UPDATER_PUBKEY`** (see `src-frontend/src-tauri/tauri.conf.json` `plugins.updater.pubkey`). In `.github/workflows/release.yml`, the secret `TAURI_UPDATER_PUBKEY` is passed into the job as `LLAMASTUDIO_UPDATER_PUBKEY`.
- `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD` — optional PFX for Windows signing; if unset, Windows builds use `--no-sign`.
- Optional Apple signing material if you add a macOS import/signing step (currently unsigned DMG when secrets are absent).

## Winget (Windows)

After a release is published, run the manual workflow `.github/workflows/winget-hash-refresh.yml` with the tag, then update `InstallerSha256` (and `ReleaseDate` if needed) under `packaging/winget/manifests/...` before submitting to `microsoft/winget-pkgs`.

## Linux Install Command

```bash
curl -fsSL https://raw.githubusercontent.com/KM-Alee/llama-studio/main/scripts/install-linux.sh | bash
```

## Trust Notes

- Tauri updater signatures verify update authenticity.
- Windows code signing reduces SmartScreen warnings.
- EV certificates or Azure Trusted Signing are the best production path.
