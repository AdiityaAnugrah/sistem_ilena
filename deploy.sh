#!/bin/bash
# Deploy script — zero-downtime
# Usage: bash deploy.sh
set -e

# Load node/npm — SSH non-interactive tidak auto-load profile
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# Fallback: cari npm dari semua kemungkinan lokasi
if ! command -v npm &>/dev/null; then
  NODE_BIN=$(find /root/.nvm/versions/node /usr/local/bin /usr/bin -name "npm" -type f 2>/dev/null | head -1)
  [ -n "$NODE_BIN" ] && export PATH="$(dirname "$NODE_BIN"):$PATH"
fi

BASE=/mine/sistem_ilena/html
cd "$BASE"

echo "[1/5] Git pull..."
git pull

echo "[2/5] Backend dependencies..."
cd "$BASE/backend"
npm install --omit=dev

echo "[3/5] Reload backend (graceful)..."
pm2 reload ilena-backend --update-env

echo "[4/5] Frontend build... (pengguna tetap terlayani)"
cd "$BASE/frontend"
npm install
npm run build

echo "[5/5] Reload frontend (graceful)..."
pm2 reload ilena-frontend --update-env

echo "Deploy selesai. Tidak ada downtime."
