#!/usr/bin/env bash
set -euo pipefail

GH_REPO="${GH_REPO:-JetSprow/J-Board}"
AGENT_TAG="${AGENT_TAG:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SERVICE_NAME="${SERVICE_NAME:-jboard-agent}"
ENV_FILE="${ENV_FILE:-/etc/jboard-agent.env}"
LATENCY_INTERVAL="${LATENCY_INTERVAL:-5m}"
TRACE_INTERVAL="${TRACE_INTERVAL:-30m}"
INSTALL_NEXTTRACE="${INSTALL_NEXTTRACE:-1}"
TMP_DIR="$(mktemp -d)"
ARCH="$(uname -m)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -z "${SERVER_URL:-}" ] || [ -z "${AUTH_TOKEN:-}" ]; then
  echo "SERVER_URL and AUTH_TOKEN are required." >&2
  echo "Example:" >&2
  echo "curl -fsSL https://raw.githubusercontent.com/${GH_REPO}/main/scripts/install-jboard-agent.sh | SERVER_URL=https://example.com AUTH_TOKEN=token bash" >&2
  exit 1
fi

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

echo "[1/8] Release tag: ${RESOLVED_TAG}"
echo "[2/8] Downloading probe agent binary: ${ASSET}"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$ASSET"

if curl -fsSL "$CHECKSUM_URL" -o "$TMP_DIR/SHA256SUMS" 2>/dev/null; then
  echo "[3/8] Verifying checksum..."
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
  echo "[3/8] Checksum file not found; skipping verification."
fi

echo "[4/8] Installing binary..."
run_as_root install -m 0755 "$TMP_DIR/$ASSET" "${INSTALL_DIR}/jboard-agent"
run_as_root mkdir -p /var/log/jboard

if [ "$INSTALL_NEXTTRACE" = "1" ] && ! command -v nexttrace >/dev/null 2>&1; then
  echo "[5/8] Installing nexttrace for route probing..."
  curl -fsSL https://raw.githubusercontent.com/nxtrace/NTrace-core/main/nt_install.sh -o "$TMP_DIR/nt_install.sh"
  run_as_root bash "$TMP_DIR/nt_install.sh"
else
  echo "[5/8] nexttrace already installed or skipped."
fi

echo "[6/8] Writing environment file..."
ENV_TMP="$TMP_DIR/jboard-agent.env"
{
  printf 'SERVER_URL=%q\n' "$SERVER_URL"
  printf 'AUTH_TOKEN=%q\n' "$AUTH_TOKEN"
  printf 'LATENCY_INTERVAL=%q\n' "$LATENCY_INTERVAL"
  printf 'TRACE_INTERVAL=%q\n' "$TRACE_INTERVAL"
} > "$ENV_TMP"
run_as_root install -m 0600 "$ENV_TMP" "$ENV_FILE"

echo "[7/8] Writing systemd service..."
SERVICE_TMP="$TMP_DIR/${SERVICE_NAME}.service"
cat > "$SERVICE_TMP" <<SERVICE
[Unit]
Description=J-Board Probe Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/jboard-agent
Restart=always
RestartSec=10
MemoryMax=64M

[Install]
WantedBy=multi-user.target
SERVICE
run_as_root install -m 0644 "$SERVICE_TMP" "/etc/systemd/system/${SERVICE_NAME}.service"

echo "[8/8] Enabling and starting service..."
run_as_root systemctl daemon-reload
run_as_root systemctl enable --now "$SERVICE_NAME"

echo
echo "Install complete."
echo
echo "Service status:"
run_as_root systemctl --no-pager --full status "$SERVICE_NAME" || true

echo
echo "Recent logs:"
run_as_root journalctl -u "$SERVICE_NAME" -n 30 --no-pager || true
