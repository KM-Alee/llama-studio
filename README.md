# LlamaStudio

<div align="center">
  <img src="readmepic.png" alt="LlamaStudio Interface" width="100%" style="margin-bottom: 20px;">

  <p align="center">
    <strong>A local-first desktop app for llama.cpp with a polished chat workflow.</strong>
    <br />
    Built with Rust, React 19, and Tauri 2.
  </p>

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#first-run">First Run</a> •
    <a href="#development">Development</a> •
    <a href="#release-builds">Release Builds</a>
  </p>
</div>

---

LlamaStudio is a local-first desktop app for [llama.cpp](https://github.com/ggerganov/llama.cpp). It bundles its own Rust backend, provides a desktop UI through Tauri, manages chat history and models locally, and guides first-time users through runtime setup.

## Features

- Local chat UI with Markdown, code highlighting, tables, math, and streaming responses
- Model scanning, import, analytics, and local GGUF management
- Normal and Advanced profiles for clean defaults or deeper control
- System prompt templates with create, edit, and delete flows
- Built-in dependency status panel for `llama-server`, `llama-cli`, and optional Hugging Face CLI
- Windows and Linux desktop packaging

## First Run

LlamaStudio is designed so the desktop app bundles its own backend.

What users need:

1. Install the LlamaStudio desktop build for their platform.
2. Open `Settings` and check the `Runtime Dependencies` section.
3. Install `llama-server` if it is missing.
4. Point `Binary Path` to `llama-server` if it is not already on `PATH`.
5. Set a models directory and import or scan GGUF models.

Notes:

- Hugging Face browsing and downloads work in-app already.
- Hugging Face CLI is optional.
- `llama-cli` is optional but improves local model inspection.

## Runtime Defaults

- Vite dev server: `6767`
- LlamaStudio backend: `6868`
- llama.cpp server: `6970`
- Default theme: `light`

## Development

```bash
# frontend
cd src-frontend
npm install
npm run lint
npm test
npm run build

# backend
cd ../src-backend
cargo test
```

## Release Builds

Desktop release targets are configured for:

- Windows: `NSIS`, `MSI`
- Linux: `AppImage`, `deb`, `rpm`

GitHub releases are built by `.github/workflows/release.yml`.

## Repository Layout

```text
src-backend/          Rust Axum backend
src-frontend/         React frontend + Tauri shell
docs/                 Product and architecture docs
.github/workflows/    CI and release automation
```

## Push Readiness

Before pushing, validate:

```bash
cd src-frontend && npm run lint && npm test && npm run build
cd ../src-backend && cargo test
```

For desktop packaging changes, also validate Tauri builds in CI or on target platforms.

## License

MIT
