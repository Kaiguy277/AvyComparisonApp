#!/usr/bin/env bash
# Print every row in public.device_tokens. Used to verify that the
# silent-push registration path on the mobile app actually wrote the
# device's Expo push token to Supabase.
#
# Usage:
#   ./scripts/check-device-tokens.sh
#
# Anon key is read from .env (EXPO_PUBLIC_SUPABASE_ANON_KEY); the
# REST endpoint is read from EXPO_PUBLIC_SUPABASE_URL.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="$repo_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "error: $env_file not found" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$env_file"

URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "error: missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY" >&2
  exit 1
fi

echo ">>> device_tokens (newest first)"
curl -s "$URL/rest/v1/device_tokens?select=token,platform,last_seen,created_at&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -m json.tool
