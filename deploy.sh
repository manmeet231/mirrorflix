#!/bin/bash
set -e

PROJECT="/root/mirrorflix-source"
FRONTEND="$PROJECT/mirrorflix"
DIST="/var/www/alterbucket/mirrorflix-dist"

echo "===== Pulling latest changes ====="
cd "$PROJECT"
git pull origin main

echo "===== Installing frontend dependencies ====="
cd "$FRONTEND"
npm ci

echo "===== Building frontend ====="
npm run build

echo "===== Deploying frontend ====="
cp -a dist/. "$DIST/"
chown -R www-data:www-data "$DIST"

echo "===== Restarting Database API ====="
systemctl enable mirrorflix-db-api
systemctl restart mirrorflix-db-api

echo "===== Checking Database API ====="
sleep 2

if ! systemctl is-active --quiet mirrorflix-db-api; then
    echo "ERROR: Database API failed!"
    journalctl -u mirrorflix-db-api -n 30 --no-pager
    exit 1
fi

if ! curl -fsS http://127.0.0.1:8001/api/genres -o /dev/null; then
    echo "ERROR: Database API health check failed!"
    exit 1
fi

echo "Database API is healthy."

echo "===== Restarting Streambert ====="
systemctl restart streambert

echo "===== Deployment Complete ====="
