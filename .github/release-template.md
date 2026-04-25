## Highlights

- Fast, local-first chat for llama.cpp
- Better first-run setup guidance
- Desktop builds for Windows and Linux

## Downloads

- Windows: use `.exe` or `.msi`
- Linux: use `.AppImage`, `.deb`, or `.rpm`

## Quick Install (Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/KM-Alee/llama-studio/main/scripts/install-linux.sh | bash
```

Optional: app plus official CPU `llama-server` (from `ggerganov/llama.cpp` Ubuntu x64 build):

```bash
curl -fsSL https://raw.githubusercontent.com/KM-Alee/llama-studio/main/scripts/install-linux.sh | bash -s -- --with-llama
```

## Notes

- The app bundles the LlamaStudio backend; the upstream `llama-server` binary is separate. Use the script’s `--with-llama` flag, or **Settings → Runtime Dependencies**, or the Windows installer’s post-install link.
- Hugging Face CLI is optional.
