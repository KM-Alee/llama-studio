# LlamaStudio Release Guide

## Release Artifacts

GitHub Actions publishes:

- Windows `.exe`
- Windows `.msi`
- Linux `.AppImage`
- Linux `.deb`
- Linux `.rpm`

## Update Delivery

The Tauri updater is configured to read:

- `https://github.com/KM-Alee/llama-studio/releases/latest/download/latest.json`

This requires release artifacts to be signed with the Tauri updater private key.

## Recommended Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBKEY`
- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

## Linux Install Command

```bash
curl -fsSL https://raw.githubusercontent.com/KM-Alee/llama-studio/main/scripts/install-linux.sh | bash
```

## Trust Notes

- Tauri updater signatures verify update authenticity.
- Windows code signing reduces SmartScreen warnings.
- EV certificates or Azure Trusted Signing are the best production path.
