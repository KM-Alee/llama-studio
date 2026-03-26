# Development Environment Setup Guide

## Prerequisites

### Already Installed (verified)
- **Rust** 1.94.0 via rustup
- **Node.js** 25.8.1
- **pnpm** 10.32.1
- **Bun** (available as alternative)

### Required: llama.cpp

You need the `llama-server` binary from llama.cpp. Options:

#### Option A: Build from source (recommended)
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DGGML_CUDA=ON   # Add -DGGML_CUDA=ON for NVIDIA GPU
cmake --build build --config Release -j$(nproc)
```
The binary will be at `build/bin/llama-server`. Add to PATH or set in AI Studio settings.

#### Option B: Download release
Download from https://github.com/ggerganov/llama.cpp/releases

### Required: A GGUF Model
Download any GGUF model. Recommended starter models:
- Llama 3.1 8B Q4_K_M (~4.5 GB, runs on 8GB VRAM)
- Phi-3 Mini Q4_K_M (~2.3 GB, runs on 4GB VRAM)  
- Mistral 7B Q4_K_M (~4.1 GB, runs on 8GB VRAM)

Place in `~/models/` or configure another directory in settings.

---

## Recommended VS Code Extensions

Install these for the best development experience:

### Essential
- **rust-analyzer** — Rust IDE support (completions, errors, refactoring)
- **Tailwind CSS IntelliSense** — Tailwind class autocomplete
- **ESLint** — TypeScript linting

### Recommended
- **Error Lens** — Inline error highlighting  
- **Pretty TypeScript Errors** — Readable TS errors
- **GitLens** — Git blame and history
- **Thunder Client** — API testing (alternative to Postman)

### Install via CLI
```bash
code --install-extension rust-lang.rust-analyzer
code --install-extension bradlc.vscode-tailwindcss  
code --install-extension dbaeumer.vscode-eslint
code --install-extension usernamehw.errorlens
code --install-extension yoavbls.pretty-ts-errors
```

---

## VS Code Settings (workspace)

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "[typescript][typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.check.command": "clippy",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## Daily Development Workflow

### Starting Development
```bash
# Terminal 1: Backend
cd src-backend && RUST_LOG=debug cargo run

# Terminal 2: Frontend  
cd src-frontend && pnpm dev
```

Or use the Makefile:
```bash
make dev
```

### Before Committing
```bash
make check     # Type check both projects
make fmt       # Format code
```

### Testing
```bash
make test-backend   # Rust tests
```

---

## Copilot Agent Configuration

This project is fully configured for GitHub Copilot with:

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Project-wide Copilot instructions |
| `.github/AGENTS.md` | Available agent definitions |
| `.github/backend.instructions.md` | Auto-applies to `src-backend/**` files |
| `.github/frontend.instructions.md` | Auto-applies to `src-frontend/**` files |
| `.github/skills/rust-backend/SKILL.md` | Rust/Axum patterns and examples |
| `.github/skills/react-frontend/SKILL.md` | React/TS/Tailwind patterns and examples |

When Copilot edits a file in `src-backend/`, it automatically loads the backend instructions.
When editing `src-frontend/`, it loads the frontend instructions.

---

## Skill Installation (Global Copilot)

To make the Rust and React skills available globally across all projects:

### Copy skills to global Copilot config:
```bash
# Create global skills directory
mkdir -p ~/.copilot/skills/rust-backend
mkdir -p ~/.copilot/skills/react-frontend

# Copy skill files
cp .github/skills/rust-backend/SKILL.md ~/.copilot/skills/rust-backend/
cp .github/skills/react-frontend/SKILL.md ~/.copilot/skills/react-frontend/
```

### Or register in global instructions:
Add to `~/.copilot/instructions/instructions.instructions.md`:
```yaml
skills:
  - name: rust-backend
    file: ~/.copilot/skills/rust-backend/SKILL.md
  - name: react-frontend  
    file: ~/.copilot/skills/react-frontend/SKILL.md
```

---

## Troubleshooting

### Backend won't compile
```bash
cd src-backend
cargo clean
cargo build 2>&1 | head -50
```

### Frontend type errors
```bash
cd src-frontend
pnpm tsc --noEmit 2>&1 | head -50
```

### llama.cpp not found
Set the path in Settings page, or:
```bash
export PATH="$PATH:/path/to/llama.cpp/build/bin"
```
