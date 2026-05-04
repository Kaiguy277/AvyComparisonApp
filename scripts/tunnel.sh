#!/usr/bin/env bash
# Spin up an Expo dev server with --tunnel so a phone running Expo Go can
# connect from any network. Kills any stale `expo start` processes first
# so a previous run doesn't fight for the port.
#
# Usage:
#   ./scripts/tunnel.sh                     # serve current checkout
#   ./scripts/tunnel.sh /path/to/worktree   # serve a specific worktree
#
# Once Metro says "Tunnel ready" the script polls localhost:8081 for the
# manifest and prints the exp:// URL — paste it into Expo Go's "Enter URL
# manually" field, or scan via the iOS camera.

set -euo pipefail

target="${1:-$(pwd)}"
if [[ ! -d "$target" ]]; then
  echo "error: $target is not a directory" >&2
  exit 1
fi
if [[ ! -f "$target/package.json" ]]; then
  echo "error: $target/package.json not found — not an Expo project?" >&2
  exit 1
fi

echo ">>> killing any stale expo dev servers"
pkill -f "expo start" 2>/dev/null || true
sleep 1

echo ">>> starting tunnel from: $target"
cd "$target"

# Run expo start --tunnel in the background, log to a tempfile so we can
# scrape the URL once Metro reports tunnel ready. Foreground the process
# afterward so Ctrl-C kills it cleanly.
log="$(mktemp -t expo-tunnel.XXXX.log)"
npx expo start --tunnel --clear >"$log" 2>&1 &
expo_pid=$!
trap 'kill "$expo_pid" 2>/dev/null || true; rm -f "$log"' EXIT

echo ">>> waiting for tunnel… (~30s, longer on first run)"
deadline=$((SECONDS + 180))
url=""
while (( SECONDS < deadline )); do
  if grep -q "Tunnel ready" "$log" 2>/dev/null; then
    # Wait one more beat for the manifest endpoint, then probe it.
    sleep 1
    manifest="$(curl -fsS -H 'expo-platform: ios' http://localhost:8081 || true)"
    url="$(printf '%s' "$manifest" | grep -oE 'https?://[a-zA-Z0-9_-]+\.exp\.direct' | head -1 || true)"
    if [[ -n "$url" ]]; then
      url="${url/https:\/\//exp://}"
      url="${url/http:\/\//exp://}"
      break
    fi
  fi
  if grep -qiE "error|failed to" "$log" 2>/dev/null; then
    echo
    echo ">>> tunnel startup error — last 30 lines:"
    tail -30 "$log"
    exit 1
  fi
  sleep 2
done

if [[ -z "$url" ]]; then
  echo ">>> timed out waiting for tunnel; showing last log lines:"
  tail -40 "$log"
  exit 1
fi

cat <<EOF

================================================================
  Tunnel ready.
  Open Expo Go on your phone and paste this URL:

    $url

  Or scan the QR rendered in this terminal (if running interactively).
================================================================

EOF

# Tail the bundler log so the user sees rebuild progress + warnings.
tail -n 0 -f "$log"
