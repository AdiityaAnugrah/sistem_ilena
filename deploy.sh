#!/bin/bash
# Deploy script — zero-downtime
# Usage: bash deploy.sh
set -e

export PATH="/root/.nvm/versions/node/v22.14.0/bin:$PATH"

BASE=/mine/sistem_ilena/html
cd "$BASE"

echo "[1/6] Git pull..."
git pull

echo "[2/6] Backend dependencies..."
cd "$BASE/backend"
npm install --omit=dev

echo "[3/6] Migrate optional Interior costs..."
node scripts/migrate-interior-costs.js --apply --deployment

echo "[4/6] Reload backend (graceful)..."
pm2 reload ilena-backend --update-env

echo "[5/6] Frontend build... (pengguna tetap terlayani)"
cd "$BASE/frontend"
npm install
npm run build

echo "[6/6] Reload frontend (graceful)..."
pm2 reload ilena-frontend --update-env

echo "Deploy selesai. Tidak ada downtime."
