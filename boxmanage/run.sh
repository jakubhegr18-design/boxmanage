#!/bin/sh
set -e

mkdir -p /data/caddy
export XDG_DATA_HOME=/data/caddy

echo "[boxmanage] Starting Caddy (HTTPS :8090)..."
caddy run --config /app/Caddyfile &
CADDY_PID=$!

trap 'kill $CADDY_PID 2>/dev/null' EXIT INT TERM

echo "[boxmanage] Starting BoxManage server (127.0.0.1:${PORT})..."
exec node /app/src/index.js
