#!/usr/bin/env bash
set -euo pipefail

GH_REPO="${GH_REPO:-Xiyueyy/J-Board}"
AGENT_TAG="${AGENT_TAG:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SERVICE_NAME="${SERVICE_NAME:-jboard-agent}"
ENV_FILE="${ENV_FILE:-/etc/jboard-agent.env}"
LATENCY_INTERVAL="${LATENCY_INTERVAL:-5m}"
TRACE_INTERVAL="${TRACE_INTERVAL:-30m}"
NET_SPEED_INTERVAL="${NET_SPEED_INTERVAL:-10s}"
NET_SPEED_INTERFACE="${NET_SPEED_INTERFACE:-}"
XRAY_ACCESS_LOG_PATH="${XRAY_ACCESS_LOG_PATH:-}"
XRAY_LOG_INTERVAL="${XRAY_LOG_INTERVAL:-1m}"
XRAY_LOG_STATE_FILE="${XRAY_LOG_STATE_FILE:-/var/lib/jboard-agent/xray-log-state.json}"
XRAY_LOG_START_AT_END="${XRAY_LOG_START_AT_END:-1}"
INSTALL_NEXTTRACE="${INSTALL_NEXTTRACE:-1}"
BUILD_FROM_SOURCE="${BUILD_FROM_SOURCE:-0}"
AGENT_REF="${AGENT_REF:-main}"
AGENT_BINARY_BASE_URL="${AGENT_BINARY_BASE_URL:-https://raw.githubusercontent.com/${GH_REPO}/${AGENT_REF}/agent/jboard-agent/dist}"
GO_VERSION="${GO_VERSION:-1.22.12}"
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

run_as_root_output() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
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


detect_goarch() {
  case "$ARCH" in
    x86_64|amd64)
      echo "amd64"
      ;;
    aarch64|arm64)
      echo "arm64"
      ;;
    *)
      echo "Unsupported architecture: $ARCH" >&2
      exit 1
      ;;
  esac
}

ensure_go() {
  if command -v go >/dev/null 2>&1; then
    command -v go
    return 0
  fi

  local goarch=""
  goarch="$(detect_goarch)"
  echo "Go not found; downloading Go ${GO_VERSION} for linux-${goarch}..." >&2
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${goarch}.tar.gz" -o "$TMP_DIR/go.tgz"
  tar -C "$TMP_DIR" -xzf "$TMP_DIR/go.tgz"
  echo "$TMP_DIR/go/bin/go"
}

build_agent_from_source() {
  local source_ref="$AGENT_REF"
  local goarch=""
  local go_bin=""
  if [ "$AGENT_TAG" != "latest" ]; then
    source_ref="$AGENT_TAG"
  fi

  goarch="$(detect_goarch)"
  go_bin="$(ensure_go)"

  echo "Building probe agent from ${GH_REPO}@${source_ref}..."
  mkdir -p "$TMP_DIR/source"
  curl -fsSL "https://codeload.github.com/${GH_REPO}/tar.gz/${source_ref}" -o "$TMP_DIR/source.tgz"
  tar -C "$TMP_DIR/source" --strip-components=1 -xzf "$TMP_DIR/source.tgz"
  (
    cd "$TMP_DIR/source/agent/jboard-agent"
    GOOS=linux GOARCH="$goarch" "$go_bin" build -ldflags "-s -w" -o "$TMP_DIR/$ASSET" ./cmd/agent
  )
}


download_agent_prebuilt() {
  local binary_url="${AGENT_BINARY_URL:-${AGENT_BINARY_BASE_URL}/${ASSET}}"
  local checksums_url="${AGENT_CHECKSUMS_URL:-${AGENT_BINARY_BASE_URL}/SHA256SUMS}"

  echo "Downloading prebuilt probe agent: ${binary_url}"
  if ! curl -fsSL "$binary_url" -o "$TMP_DIR/$ASSET"; then
    return 1
  fi

  if curl -fsSL "$checksums_url" -o "$TMP_DIR/SHA256SUMS" 2>/dev/null; then
    if grep "  ${ASSET}$" "$TMP_DIR/SHA256SUMS" > "$TMP_DIR/SHA256SUMS.current"; then
      (
        cd "$TMP_DIR"
        if command -v sha256sum >/dev/null 2>&1; then
          sha256sum -c SHA256SUMS.current >/dev/null
        else
          shasum -a 256 -c SHA256SUMS.current >/dev/null
        fi
      )
      echo "Checksum verified."
    fi
  fi

  return 0
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

detect_xray_access_log() {
  if [ -n "$XRAY_ACCESS_LOG_PATH" ] && run_as_root_output test -s "$XRAY_ACCESS_LOG_PATH" 2>/dev/null; then
    printf '%s\n' "$XRAY_ACCESS_LOG_PATH"
    return 0
  fi

  for candidate in \
    /docker/3xui/logs/access.log \
    /docker/3x-ui/logs/access.log \
    /docker/x-ui/logs/access.log \
    /docker/3xui/access.log \
    /docker/3x-ui/access.log \
    /docker/x-ui/access.log \
    /docker/3xui/db/access.log \
    /usr/local/x-ui/access.log \
    /usr/local/x-ui/bin/access.log \
    /usr/local/x-ui/xray/access.log \
    /etc/x-ui/access.log \
    /etc/x-ui/xray/access.log \
    /var/log/xray/access.log \
    /var/log/x-ui/access.log \
    /opt/3x-ui/access.log \
    /opt/x-ui/access.log; do
    if run_as_root_output test -f "$candidate" 2>/dev/null; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  for root in /docker /usr/local /etc /var/log /opt /var/lib/docker/volumes; do
    if ! run_as_root_output test -d "$root" 2>/dev/null; then
      continue
    fi
    while IFS= read -r candidate; do
      case "$candidate" in
        *x-ui*|*3x-ui*|*3xui*|*xray*|*Xray*)
          printf '%s\n' "$candidate"
          return 0
          ;;
      esac
    done < <(run_as_root_output find "$root" -type f \( -name 'access.log' -o -name '*xray*.log' \) 2>/dev/null | head -n 80)
  done

  if [ -n "$XRAY_ACCESS_LOG_PATH" ] && run_as_root_output test -f "$XRAY_ACCESS_LOG_PATH" 2>/dev/null; then
    printf '%s\n' "$XRAY_ACCESS_LOG_PATH"
    return 0
  fi

  return 1
}

prepare_xray_access_log() {
  local detected=""
  detected="$(detect_xray_access_log || true)"
  if [ -z "$detected" ]; then
    XRAY_ACCESS_LOG_PATH=""
    return 1
  fi

  XRAY_ACCESS_LOG_PATH="$detected"
  run_as_root mkdir -p "$(dirname "$XRAY_LOG_STATE_FILE")"
  if run_as_root_output test -f "$XRAY_ACCESS_LOG_PATH" 2>/dev/null; then
    run_as_root chmod a+r "$XRAY_ACCESS_LOG_PATH" 2>/dev/null || true
  fi
  return 0
}

print_xray_log_hint() {
  cat <<'HINT'

Xray access log was not found automatically, so node access risk telemetry is disabled for now.
To enable it, open 3x-ui panel -> Xray Config and set:

"log": {
  "access": "/usr/local/x-ui/access.log",
  "error": "/usr/local/x-ui/error.log",
  "loglevel": "warning"
}

Then restart x-ui and rerun this installer, or add XRAY_ACCESS_LOG_PATH=/usr/local/x-ui/access.log to /etc/jboard-agent.env.
HINT
}

service_candidates() {
  printf '%s\n' "$SERVICE_NAME" jboard-agent jboard-probe-agent j-board-agent jboard-probe \
    | awk 'NF && !seen[$0]++'
}

agent_service_exists() {
  local candidate="$1"
  run_as_root_output test -f "/etc/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output test -f "/lib/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output test -f "/usr/lib/systemd/system/${candidate}.service" 2>/dev/null \
    || run_as_root_output systemctl is-active --quiet "${candidate}.service" 2>/dev/null \
    || run_as_root_output systemctl is-enabled --quiet "${candidate}.service" 2>/dev/null
}

remove_old_agent_services() {
  local removed=0
  local candidate=""

  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    if agent_service_exists "$candidate"; then
      echo "Removing old agent service: ${candidate}.service"
      run_as_root systemctl stop "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root systemctl disable "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root systemctl reset-failed "${candidate}.service" >/dev/null 2>&1 || true
      run_as_root rm -f \
        "/etc/systemd/system/${candidate}.service" \
        "/lib/systemd/system/${candidate}.service" \
        "/usr/lib/systemd/system/${candidate}.service"
      removed=1
    fi
  done < <(service_candidates)

  if [ "$removed" = "1" ]; then
    run_as_root systemctl daemon-reload
  else
    echo "No old agent service found."
  fi
}

write_systemd_service() {
  local service_tmp="$TMP_DIR/${SERVICE_NAME}.service"
  cat > "$service_tmp" <<SERVICE
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
  run_as_root install -m 0644 "$service_tmp" "/etc/systemd/system/${SERVICE_NAME}.service"
}

ASSET="$(detect_asset)"
DOWNLOADED_AGENT=0

if [ "$BUILD_FROM_SOURCE" = "1" ] || [ "$BUILD_FROM_SOURCE" = "true" ]; then
  echo "[1/10] Building from source is forced."
  build_agent_from_source
  DOWNLOADED_AGENT=1
else
  echo "[1/10] Downloading prebuilt agent from repository..."
  if download_agent_prebuilt; then
    DOWNLOADED_AGENT=1
  else
    echo "Prebuilt binary not found in repository; trying GitHub release..."
    RESOLVED_TAG="$(resolve_release_tag || true)"
    if [ -n "$RESOLVED_TAG" ]; then
      DOWNLOAD_BASE="https://github.com/${GH_REPO}/releases/download/${RESOLVED_TAG}"
      AGENT_BINARY_URL="${DOWNLOAD_BASE}/${ASSET}"
      AGENT_CHECKSUMS_URL="${DOWNLOAD_BASE}/SHA256SUMS"
      if download_agent_prebuilt; then
        DOWNLOADED_AGENT=1
      fi
    fi
  fi

  if [ "$DOWNLOADED_AGENT" != "1" ]; then
    echo "Failed to download prebuilt agent binary." >&2
    echo "Do not compile on small nodes by default. If you really want to compile here, rerun with BUILD_FROM_SOURCE=1." >&2
    exit 1
  fi
fi

echo "[4/10] Removing old agent service..."
remove_old_agent_services

echo "[5/10] Installing binary..."
run_as_root install -m 0755 "$TMP_DIR/$ASSET" "${INSTALL_DIR}/jboard-agent"
run_as_root mkdir -p /var/log/jboard /var/lib/jboard-agent

if [ "$INSTALL_NEXTTRACE" = "1" ] && ! command -v nexttrace >/dev/null 2>&1; then
  echo "[6/10] Installing nexttrace for route probing..."
  curl -fsSL https://raw.githubusercontent.com/nxtrace/NTrace-core/main/nt_install.sh -o "$TMP_DIR/nt_install.sh"
  run_as_root bash "$TMP_DIR/nt_install.sh"
else
  echo "[6/10] nexttrace already installed or skipped."
fi

echo "[7/10] Detecting Xray access log..."
if prepare_xray_access_log; then
  echo "Found Xray access log: ${XRAY_ACCESS_LOG_PATH}"
else
  echo "Xray access log not found; continuing without node access risk telemetry."
fi

echo "[8/10] Writing environment file..."
ENV_TMP="$TMP_DIR/jboard-agent.env"
{
  printf 'SERVER_URL=%q\n' "$SERVER_URL"
  printf 'AUTH_TOKEN=%q\n' "$AUTH_TOKEN"
  printf 'LATENCY_INTERVAL=%q\n' "$LATENCY_INTERVAL"
  printf 'TRACE_INTERVAL=%q\n' "$TRACE_INTERVAL"
  printf 'NET_SPEED_INTERVAL=%q\n' "$NET_SPEED_INTERVAL"
  printf 'NET_SPEED_INTERFACE=%q\n' "$NET_SPEED_INTERFACE"
  printf 'XRAY_ACCESS_LOG_PATH=%q\n' "$XRAY_ACCESS_LOG_PATH"
  printf 'XRAY_LOG_INTERVAL=%q\n' "$XRAY_LOG_INTERVAL"
  printf 'XRAY_LOG_STATE_FILE=%q\n' "$XRAY_LOG_STATE_FILE"
  printf 'XRAY_LOG_START_AT_END=%q\n' "$XRAY_LOG_START_AT_END"
} > "$ENV_TMP"
run_as_root install -m 0600 "$ENV_TMP" "$ENV_FILE"

echo "[9/10] Writing systemd service..."
write_systemd_service

echo "[10/10] Enabling and starting service..."
run_as_root systemctl daemon-reload
run_as_root systemctl enable --now "$SERVICE_NAME"

echo
echo "Install complete."
if [ -n "$XRAY_ACCESS_LOG_PATH" ]; then
  echo "Node access risk telemetry: enabled (${XRAY_ACCESS_LOG_PATH})"
else
  echo "Node access risk telemetry: disabled"
  print_xray_log_hint
fi

echo
echo "Service status:"
run_as_root systemctl --no-pager --full status "$SERVICE_NAME" || true

echo
echo "Recent logs:"
run_as_root journalctl -u "$SERVICE_NAME" -n 30 --no-pager || true
