# Security Policy

## Supported scope

LlamaStudio is designed as a local-first application. The main security boundary is that both the app server and managed `llama-server` process stay bound to `127.0.0.1`.

Security-sensitive areas include:

- filesystem path handling for model import and downloads
- subprocess execution and argument handling for `llama-server`
- configuration persistence and local data storage
- any change that could expose the app beyond localhost

## Reporting a vulnerability

Please do not open a public GitHub issue for undisclosed vulnerabilities.

Report security issues privately with:

- a clear description of the issue
- impact assessment
- reproduction steps or proof of concept
- affected OS and version details

Until a dedicated security contact is published, add a private maintainer contact before accepting external security reports.

## Security expectations for contributors

- Do not change bind addresses from `127.0.0.1` to `0.0.0.0`.
- Validate all user-controlled paths.
- Avoid passing unsanitized input into subprocess arguments.
- Keep CORS restricted to local development origins only.
- Do not commit secrets, tokens, or personal machine paths.
