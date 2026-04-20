# Contributing to LlamaStudio

## Development setup

1. Install Rust stable, Node.js 20+, and pnpm.
2. Install frontend dependencies with `make install`.
3. Start the browser workflow with `make dev` or the desktop workflow with `make dev-desktop`.

The default development ports are:

- Vite: `6767`
- LlamaStudio backend: `6868`
- llama.cpp server: `6970`

The backend must remain bound to `127.0.0.1`. Do not introduce changes that expose LlamaStudio or `llama-server` to the network.

## Project conventions

- Keep backend API handlers in `src-backend/src/routes/` and return `AppResult<T>`.
- Route all frontend HTTP calls through `src-frontend/src/lib/api.ts`.
- Respect the normal versus advanced profile split. Advanced-only UI must remain behind `profile === 'advanced'`.
- Prefer small, targeted pull requests over large mixed refactors.

## Before opening a pull request

Run the full local checks:

```bash
make fmt
make check
make lint
make test
```

If you change packaging or release flow, also verify `make release` and `make release-desktop`.

If your change affects behavior, add or update tests in either `src-backend/tests/` or `src-frontend/src/__tests__/`.

## Pull request guidance

- Describe the user-visible behavior change.
- Call out any backend, database, or configuration impact.
- Include screenshots or short recordings for UI changes.
- Keep commits focused so review remains tractable.

## Reporting issues

When filing a bug, include:

- OS and architecture
- Rust, Node.js, and pnpm versions
- Steps to reproduce
- Relevant logs from the backend or browser console
- Whether the issue reproduces with a fresh config and an empty models directory
