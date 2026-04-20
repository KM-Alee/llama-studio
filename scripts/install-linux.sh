#!/usr/bin/env bash

set -euo pipefail

REPO="KM-Alee/llama-studio"
INSTALL_DIR="${HOME}/.local/opt/llamastudio"
BIN_DIR="${HOME}/.local/bin"
APPIMAGE_PATH="${INSTALL_DIR}/LlamaStudio.AppImage"
DESKTOP_FILE_DIR="${HOME}/.local/share/applications"
DESKTOP_FILE_PATH="${DESKTOP_FILE_DIR}/llamastudio.desktop"

mkdir -p "${INSTALL_DIR}" "${BIN_DIR}" "${DESKTOP_FILE_DIR}"

echo "Fetching latest LlamaStudio release metadata..."
release_json=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")
appimage_url=$(printf '%s' "${release_json}" | grep -o 'https://[^"[:space:]]*\.AppImage' | head -n 1)

if [[ -z "${appimage_url}" ]]; then
  echo "Could not locate an AppImage asset in the latest release."
  exit 1
fi

echo "Downloading AppImage..."
curl -fL "${appimage_url}" -o "${APPIMAGE_PATH}"
chmod +x "${APPIMAGE_PATH}"

cat > "${BIN_DIR}/llamastudio" <<EOF
#!/usr/bin/env bash
exec "${APPIMAGE_PATH}" "$@"
EOF
chmod +x "${BIN_DIR}/llamastudio"

cat > "${DESKTOP_FILE_PATH}" <<EOF
[Desktop Entry]
Type=Application
Name=LlamaStudio
Exec=${BIN_DIR}/llamastudio
Terminal=false
Categories=Utility;Development;
StartupNotify=true
EOF

echo
echo "LlamaStudio installed successfully."
echo "Run it with: llamastudio"
echo "If ~/.local/bin is not on your PATH, add this line to your shell config:"
echo 'export PATH="$HOME/.local/bin:$PATH"'
