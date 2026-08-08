#!/usr/bin/env bash
# Print every row in public.device_tokens. Used to verify that the
# silent-push registration path on the mobile app actually wrote the
# device's Expo push token to Supabase.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY=... ./scripts/check-device-tokens.sh
#
# Requires the service role key: since migration 20260807000000 the
# anon role can only INSERT into device_tokens (reads were a push-token
# harvest vector), so listing rows needs service-role access. The REST
# endpoint is read from .env (EXPO_PUBLIC_SUPABASE_URL).

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
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [[ -z "$URL" ]]; then
  echo "error: missing EXPO_PUBLIC_SUPABASE_URL in .env" >&2
  exit 1
fi
if [[ -z "$KEY" ]]; then
  echo "error: set SUPABASE_SERVICE_ROLE_KEY (anon can no longer read device_tokens" >&2
  echo "       — migration 20260807000000). Find it in the Supabase dashboard → API." >&2
  exit 1
fi

echo ">>> device_tokens (newest first)"
curl -s "$URL/rest/v1/device_tokens?select=token,platform,last_seen,created_at&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -m json.tool
