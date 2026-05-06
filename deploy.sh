#!/bin/bash
# Deploy script — zero-downtime
# Usage: bash deploy.sh
set -e

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
