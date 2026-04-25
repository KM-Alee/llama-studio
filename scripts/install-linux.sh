#!/usr/bin/env bash
# Guided install: LlamaStudio from the latest GitHub release, plus optional system
# prep and (optional) CPU llama.cpp binaries. Prefers .deb / .rpm when they match
# the detected distro; otherwise AppImage with launcher, .desktop, and menu icon.
#
# One-liner (main branch script):
#   curl -fsSL https://raw.githubusercontent.com/KM-Alee/llama-studio/main/scripts/install-linux.sh | bash
#
# With prebuilt CPU llama-server/llama-cli from official llama.cpp (Ubuntu x64 build; works on most distros):
#   curl -fsSL ... | bash -s -- --with-llama
#
# Environment:
#   LLAMASTUDIO_INSTALL_REPO=owner/name   Override GitHub repo (default KM-Alee/llama-studio)

set -euo pipefail

REPO="${LLAMASTUDIO_INSTALL_REPO:-KM-Alee/llama-studio}"
UPSTREAM_LLAMA_REPO="ggerganov/llama.cpp"
UPSTREAM_ICON_URL="https://raw.githubusercontent.com/KM-Alee/llama-studio/main/src-frontend/src-tauri/icons/app-icon.png"
INSTALL_DIR="${HOME}/.local/opt/llamastudio"
BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.local/share/llamastudio"
DESKTOP_FILE_DIR="${HOME}/.local/share/applications"
DESKTOP_FILE_PATH="${DESKTOP_FILE_DIR}/llamastudio.desktop"
ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
ICON_PATH="${ICON_DIR}/llamastudio.png"
LLAMA_STAGING="${INSTALL_DIR}/llama-cpp"

WITH_LLAMA=0
SKIP_DEPS=0

usage() {
  cat <<EOF
Usage: [environment vars] install-linux.sh [options]
  (When piped from curl, use:  curl ... | bash -s -- --help)

  Repo: ${REPO} — native package or AppImage+launcher+menu icon, optional CPU llama.cpp.
Options:
  --with-llama   After the app, fetch latest ggerganov/llama.cpp "ubuntu x64" CPU bundle
                 and link llama-server / llama-cli into ${BIN_DIR} (skipped if already on PATH).
  --no-deps      Skip apt/dnf/pacman steps (only curl and manual deps).
  -h, --help     This help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-llama) WITH_LLAMA=1 ;;
    --no-deps) SKIP_DEPS=1 ;;
    -h | --help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

mkdir -p "${INSTALL_DIR}" "${BIN_DIR}" "${DESKTOP_FILE_DIR}" "${ICON_DIR}" "${DATA_DIR}"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

ensure_icon() {
  if [[ -f "${ICON_PATH}" ]]; then
    return 0
  fi
  if curl -fsSL -o "${ICON_PATH}.part" "${UPSTREAM_ICON_URL}"; then
    mv -f "${ICON_PATH}.part" "${ICON_PATH}"
  else
    rm -f "${ICON_PATH}.part"
  fi
}

update_menus() {
  if have_cmd update-desktop-database; then
    update-desktop-database "${DESKTOP_FILE_DIR}" 2>/dev/null || true
  fi
  if have_cmd gtk-update-icon-cache; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
  fi
}

# Install common packages that make curl/AppImage/optional jq reliable per distro family.
install_system_prerequisites() {
  if [[ "${SKIP_DEPS}" -eq 1 ]]; then
    return 0
  fi
  if ! have_cmd sudo; then
    echo "Note: sudo not found; skipping automatic dependency install. Install curl and (for AppImage) fuse2/fuse3 if needed."
    return 0
  fi

  case "${family}" in
    debian)
      echo "Installing base packages (curl, FUSE, jq) with apt — sudo may prompt for your password."
      sudo apt-get update -y || true
      if ! sudo apt-get install -y ca-certificates curl libfuse2 fuse3 2>/dev/null; then
        sudo apt-get install -y ca-certificates curl 2>/dev/null || true
      fi
      have_cmd jq || sudo apt-get install -y jq 2>/dev/null || true
      ;;
    fedora)
      echo "Installing base packages with dnf — sudo required..."
      sudo dnf install -y ca-certificates curl fuse fuse-libs 2>/dev/null || \
        sudo dnf install -y ca-certificates curl
      have_cmd jq || sudo dnf install -y jq 2>/dev/null || true
      ;;
    suse)
      echo "Installing base packages with zypper — sudo required..."
      sudo zypper --non-interactive in -y ca-certificates curl fuse libfuse2-1 2>/dev/null || \
        sudo zypper --non-interactive in -y ca-certificates curl
      have_cmd jq || sudo zypper --non-interactive in -y jq 2>/dev/null || true
      ;;
    arch)
      echo "Installing base packages with pacman — sudo required..."
      sudo pacman -S --needed --noconfirm ca-certificates curl 2>/dev/null || true
      # libfuse2 for some AppImage builds; fuse3 is the common dependency name on Arch
      sudo pacman -S --needed --noconfirm fuse2 fuse3 2>/dev/null || \
        sudo pacman -S --needed --noconfirm fuse3 2>/dev/null || true
      have_cmd jq || sudo pacman -S --needed --noconfirm jq 2>/dev/null || true
      ;;
    alpine)
      if have_cmd apk; then
        echo "Installing base packages with apk — sudo required..."
        sudo apk add --no-cache ca-certificates curl curl-doc fuse3 jq 2>/dev/null || \
          sudo apk add --no-cache ca-certificates curl
      fi
      ;;
    *)
      echo "Unknown distro family; if AppImage fails to run, install FUSE and curl for your system."
      ;;
  esac
}

pick_ubuntu_x64_cpu_asset() {
  local release_json="$1"
  if have_cmd jq; then
    # Plain CPU "ubuntu x64" bundle: exclude known accelerated suffixes in the filename.
    printf '%s' "${release_json}" | jq -r '
      [.assets[]? | select(
        (.name | test("bin-ubuntu-x64"; "i")) and
        (.name | endswith(".tar.zst") or endswith(".tar.gz") or endswith(".zip")) and
        (.name | (test("vulkan|rocm|cuda|cann|musa|sycl|hip"; "i")|not))
      ) | .browser_download_url] | .[0] // empty
    '
  else
    printf ''
  fi
}

install_llama_upstream_cpu() {
  if have_cmd llama-server; then
    echo "llama-server already on PATH: $(command -v llama-server); skipping CPU binary download."
    if ! have_cmd llama-cli; then
      echo "Optional: install llama-cli for best metadata support (or re-run with no llama-server on PATH)."
    fi
    return 0
  fi

  echo "Fetching latest ${UPSTREAM_LLAMA_REPO} release (CPU Ubuntu x64 build)..."
  local lmeta
  lmeta="$(curl -fsSL "https://api.github.com/repos/${UPSTREAM_LLAMA_REPO}/releases/latest")" || {
    echo "Could not query llama.cpp releases; install from: https://github.com/${UPSTREAM_LLAMA_REPO}/releases" >&2
    return 0
  }
  local asset_url
  asset_url="$(pick_ubuntu_x64_cpu_asset "${lmeta}")"
  if [[ -z "${asset_url}" ]]; then
    echo "No matching generic CPU binary found in the latest release; see https://github.com/${UPSTREAM_LLAMA_REPO}/releases" >&2
    return 0
  fi

  mkdir -p "${LLAMA_STAGING}"
  local ext="${asset_url##*.}"
  if [[ "${asset_url}" == *.tar.zst ]]; then
    ext="tar.zst"
  elif [[ "${asset_url}" == *.tar.gz ]]; then
    ext="tgz"
  else
    ext="zip"
  fi
  local archive="${LLAMA_STAGING}/llama-upstream-${ext}"
  echo "Downloading $(basename "${asset_url}")..."
  curl -fL "${asset_url}" -o "${archive}"

  rm -rf "${LLAMA_STAGING}/extracted"
  mkdir -p "${LLAMA_STAGING}/extracted"
  case "${ext}" in
    tar.zst)
      if have_cmd tar && tar --version 2>&1 | grep -q zstd; then
        tar -xaf "${archive}" -C "${LLAMA_STAGING}/extracted"
      else
        echo "Install zstd and retry, or extract manually: ${archive}" >&2
        return 0
      fi
      ;;
    tgz) tar -xzf "${archive}" -C "${LLAMA_STAGING}/extracted" ;;
    zip)
      if have_cmd unzip; then
        unzip -o "${archive}" -d "${LLAMA_STAGING}/extracted"
      else
        echo "unzip not found; extract manually: ${archive}" >&2
        return 0
      fi
      ;;
  esac

  # Find llama-server binary (any depth)
  local server_path cli_path
  server_path="$(find "${LLAMA_STAGING}/extracted" -type f \( -name 'llama-server' -o -name 'llama-server.exe' \) 2>/dev/null | head -1 || true)"
  cli_path="$(find "${LLAMA_STAGING}/extracted" -type f \( -name 'llama-cli' -o -name 'llama-cli.exe' \) 2>/dev/null | head -1 || true)"

  if [[ -n "${server_path}" && -f "${server_path}" ]]; then
    chmod +x "${server_path}" || true
    ln -sf "${server_path}" "${BIN_DIR}/llama-server"
    echo "Linked: ${BIN_DIR}/llama-server -> ${server_path}"
  else
    echo "Could not find llama-server inside the archive; extract and add to PATH yourself." >&2
  fi
  if [[ -n "${cli_path}" && -f "${cli_path}" ]]; then
    chmod +x "${cli_path}" || true
    ln -sf "${cli_path}" "${BIN_DIR}/llama-cli"
    echo "Linked: ${BIN_DIR}/llama-cli -> ${cli_path}"
  fi
}

pick_asset_url() {
  local ext="$1"
  if have_cmd jq; then
    printf '%s' "${release_json}" | jq -r --arg ext "${ext}" \
      '.assets[]? | select(.name | endswith($ext)) | .browser_download_url' | head -n 1
  elif have_cmd python3; then
    printf '%s' "${release_json}" | python3 -c "import json,sys; ext=sys.argv[1]; j=json.load(sys.stdin); \
print(next((a['browser_download_url'] for a in j.get('assets',[]) if str(a.get('name','')).endswith(ext)), ''))" "${ext}"
  else
    case "${ext}" in
      .deb) printf '%s' "${release_json}" | grep -oE 'https://[^"[:space:]]+\.deb' | head -n 1 || true ;;
      .rpm) printf '%s' "${release_json}" | grep -oE 'https://[^"[:space:]]+\.rpm' | head -n 1 || true ;;
      .AppImage) printf '%s' "${release_json}" | grep -oE 'https://[^"[:space:]]+\.AppImage' | head -n 1 || true ;;
      *) printf '' ;;
    esac
  fi
}

detect_family() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    local id="${ID:-}"
    case "${id}" in
      ubuntu | debian | linuxmint | pop | zorin | elementary | kali) printf 'debian' && return ;;
      fedora | rhel | centos | rocky | almalinux) printf 'fedora' && return ;;
      opensuse* | sled | sles) printf 'suse' && return ;;
      arch | artix | garuda | manjaro | endeavouros | cachyos) printf 'arch' && return ;;
      alpine) printf 'alpine' && return ;;
    esac
    case " ${ID_LIKE:-} " in
      *" debian "*) printf 'debian' && return ;;
      *" rhel fedora "*) printf 'fedora' && return ;;
      *" fedora "*) printf 'fedora' && return ;;
      *" suse "*) printf 'suse' && return ;;
      *" arch "*) printf 'arch' && return ;;
    esac
  fi
  printf 'unknown'
}

echo "==> LlamaStudio guided install"
echo "    Repository: ${REPO}"
family="$(detect_family)"
echo "Detected distro family: ${family}"
echo "==> System prerequisites"
install_system_prerequisites
echo
echo "Fetching latest LlamaStudio release metadata from ${REPO}..."
release_json="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"

install_deb() {
  local url="$1"
  local deb_path="${INSTALL_DIR}/LlamaStudio_latest_amd64.deb"
  echo "Downloading .deb package..."
  curl -fL "${url}" -o "${deb_path}"
  if have_cmd sudo; then
    if have_cmd apt-get; then
      echo "Installing with apt (requires sudo)..."
      sudo apt-get install -y "${deb_path}"
    elif have_cmd dpkg; then
      echo "Installing with dpkg (requires sudo)..."
      sudo dpkg -i "${deb_path}" || sudo apt-get install -f -y
    else
      echo "Found .deb but no apt-get/dpkg; install manually: ${deb_path}"
      exit 1
    fi
  else
    echo "sudo not available; install the .deb manually: ${deb_path}"
    exit 1
  fi
}

install_rpm() {
  local url="$1"
  local rpm_path="${INSTALL_DIR}/LlamaStudio_latest.x86_64.rpm"
  echo "Downloading .rpm package..."
  curl -fL "${url}" -o "${rpm_path}"
  if ! have_cmd sudo; then
    echo "sudo not available; install the .rpm manually: ${rpm_path}"
    exit 1
  fi
  if have_cmd dnf; then
    echo "Installing with dnf (requires sudo)..."
    sudo dnf install -y "${rpm_path}"
  elif have_cmd zypper; then
    echo "Installing with zypper (requires sudo)..."
    sudo zypper --non-interactive install -y "${rpm_path}"
  elif have_cmd rpm; then
    echo "Installing with rpm (requires sudo)..."
    sudo rpm -Uvh --force "${rpm_path}"
  else
    echo "Found .rpm but no dnf/zypper/rpm; install manually: ${rpm_path}"
    exit 1
  fi
}

install_appimage() {
  local url="$1"
  local appimage_path="${INSTALL_DIR}/LlamaStudio.AppImage"
  echo "Downloading AppImage..."
  curl -fL "${url}" -o "${appimage_path}"
  chmod +x "${appimage_path}"

  ensure_icon

  cat > "${BIN_DIR}/llamastudio" <<EOF
#!/usr/bin/env bash
exec "${appimage_path}" "\$@"
EOF
  chmod +x "${BIN_DIR}/llamastudio"

  local icon_line=""
  if [[ -f "${ICON_PATH}" ]]; then
    icon_line="Icon=llamastudio"
  fi

  cat > "${DESKTOP_FILE_PATH}" <<EOF
[Desktop Entry]
Type=Application
Name=LlamaStudio
Comment=Local-first desktop for llama.cpp
Exec=${BIN_DIR}/llamastudio
Terminal=false
Categories=Utility;Development;
StartupNotify=true
${icon_line}
EOF

  update_menus
}

post_install_message() {
  local method="$1"
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  LlamaStudio is installed (${method})."
  if [[ "${WITH_LLAMA}" -eq 1 ]]; then
    echo "  If the optional step ran, check for: ${BIN_DIR}/llama-server  ${BIN_DIR}/llama-cli"
  fi
  echo
  echo "  • Start: open your app menu and search for \"LlamaStudio\" (icon may take a log-out/in to appear)."
  if [[ "${method}" == *"AppImage"* ]]; then
    echo "  • Or run: ${BIN_DIR}/llamastudio"
  elif have_cmd llamastudio; then
    echo "  • Or run: $(command -v llamastudio)"
  fi
  echo "  • llama.cpp: Settings → Runtime Dependencies. Optional CPU one-liner:  ... | bash -s -- --with-llama"
  echo "  • If needed, add:  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

deb_url="$(pick_asset_url '.deb')"
rpm_url="$(pick_asset_url '.rpm')"
appimage_url="$(pick_asset_url '.AppImage')"

if [[ "${family}" == "debian" && -n "${deb_url}" ]]; then
  install_deb "${deb_url}"
  ensure_icon
  update_menus
  METHOD="Debian package"
elif [[ ( "${family}" == "fedora" || "${family}" == "suse" ) && -n "${rpm_url}" ]]; then
  install_rpm "${rpm_url}"
  ensure_icon
  update_menus
  METHOD="RPM package"
elif [[ -n "${appimage_url}" ]]; then
  echo "Using AppImage (no .deb/.rpm for this system or native package not published)."
  install_appimage "${appimage_url}"
  METHOD="AppImage + desktop launcher"
else
  echo "Could not find a supported asset (.deb, .rpm, or .AppImage) in the latest release."
  exit 1
fi

if [[ "${WITH_LLAMA}" -eq 1 ]]; then
  echo
  echo "==> Optional: llama.cpp CPU binaries (official Ubuntu x64 bundle from ggerganov/llama.cpp)"
  install_llama_upstream_cpu || true
fi

post_install_message "${METHOD}"

exit 0
