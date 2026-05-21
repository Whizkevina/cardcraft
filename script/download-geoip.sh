#!/usr/bin/env bash
# Downloads MaxMind GeoLite2-Country.mmdb for production deploys (e.g. Render).
# Requires MAXMIND_LICENSE_KEY. Skips if GEOIP_DB_PATH already exists.
set -euo pipefail

TARGET="${GEOIP_DB_PATH:-./GeoLite2-Country.mmdb}"

if [ -f "$TARGET" ]; then
  echo "[geoip] Database already present at ${TARGET} — skipping download"
  exit 0
fi

if [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "[geoip] MAXMIND_LICENSE_KEY not set — skipping download"
  echo "[geoip] Country lookup will be disabled unless you commit GeoLite2-Country.mmdb"
  exit 0
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[geoip] Downloading GeoLite2-Country from MaxMind..."
curl -fsSL \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" \
  | tar xz -C "$TMPDIR"

MMDB="$(find "$TMPDIR" -name 'GeoLite2-Country.mmdb' -print -quit)"
if [ -z "$MMDB" ] || [ ! -f "$MMDB" ]; then
  echo "[geoip] ERROR: GeoLite2-Country.mmdb not found in downloaded archive" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
cp "$MMDB" "$TARGET"
echo "[geoip] Saved to ${TARGET} ($(wc -c < "$TARGET" | awk '{printf "%.1f MB", $1/1024/1024}'))"
