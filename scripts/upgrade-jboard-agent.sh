#!/usr/bin/env bash
set -euo pipefail

GH_REPO="${GH_REPO:-JetSprow/J-Board}"
AGENT_TAG="${AGENT_TAG:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SERVICE_NAME="${SERVICE_NAME:-jboard-agent}"
TMP_DIR="$(mktemp -d)"
ARCH="$(uname -m)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "This script needs root privileges. Re-run as root or install sudo." >&2
    exit 1
  fi
}

detect_asset() {
  case "$ARCH" in
    x86_64|amd64)
      echo "jboard-agent-linux-amd64"
      ;;
    aarch64|arm64)
      echo "jboard-agent-linux-arm64"
      ;;
    *)
      echo "Unsupported architecture: $ARCH" >&2
      exit 1
      ;;
  esac
}

resolve_release_tag() {
  if [ "$AGENT_TAG" != "latest" ]; then
    echo "$AGENT_TAG"
    return
  fi

  curl -fsSL "https://api.github.com/repos/${GH_REPO}/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1
}

ASSET="$(detect_asset)"
RESOLVED_TAG="$(resolve_release_tag)"

if [ -z "$RESOLVED_TAG" ]; then
  echo "Failed to resolve release tag for ${GH_REPO}" >&2
  exit 1
fi

DOWNLOAD_BASE="https://github.com/${GH_REPO}/releases/download/${RESOLVED_TAG}"
DOWNLOAD_URL="${DOWNLOAD_BASE}/${ASSET}"
CHECKSUM_URL="${DOWNLOAD_BASE}/SHA256SUMS"

echo "[1/5] Release tag: ${RESOLVED_TAG}"
echo "[2/5] Downloading probe agent binary: ${ASSET}"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$ASSET"

if curl -fsSL "$CHECKSUM_URL" -o "$TMP_DIR/SHA256SUMS" 2>/dev/null; then
  echo "[3/5] Verifying checksum..."
  grep "  ${ASSET}$" "$TMP_DIR/SHA256SUMS" > "$TMP_DIR/SHA256SUMS.current"
  (
    cd "$TMP_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c SHA256SUMS.current >/dev/null
    else
      shasum -a 256 -c SHA256SUMS.current >/dev/null
    fi
  )
else
  echo "[3/5] Checksum file not found; skipping verification."
fi

echo "[4/5] Installing binary..."
run_as_root install -m 0755 "$TMP_DIR/$ASSET" "${INSTALL_DIR}/jboard-agent"
run_as_root mkdir -p /var/log/jboard

echo "[5/5] Restarting service..."
run_as_root systemctl daemon-reload
run_as_root systemctl restart "$SERVICE_NAME"

echo
echo "Upgrade complete."
echo
echo "Service status:"
run_as_root systemctl --no-pager --full status "$SERVICE_NAME" || true

echo
echo "Recent logs:"
run_as_root journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
