#!/bin/sh
set -e

mkdir -p /data/caddy
CERT_DIR=/data/caddy

# Zjisti IP adresu HA hostitele (Supervisor API) — certifikát musí mít tuto IP v SAN,
# aby prohlížeč úspěšně dokončil TLS handshake při přístupu přes https://IP:8090.
IP=""
if [ -n "$SUPERVISOR_TOKEN" ]; then
  IP=$(wget -qO- -T 5 --header="Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/core/info \
    | sed -n 's/.*"ip_address"[^"]*"\([^"]*\)".*/\1/p')
fi
[ -z "$IP" ] && IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$IP" ] && IP=127.0.0.1

# Generuj/obnov certifikát, pokud chybí nebo neobsahuje aktuální IP
NEED_GEN=0
if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
  NEED_GEN=1
elif ! openssl x509 -in "$CERT_DIR/cert.pem" -noout -text 2>/dev/null | grep -q "IP Address:$IP"; then
  NEED_GEN=1
fi

if [ "$NEED_GEN" = 1 ]; then
  echo "[boxmanage] Generating self-signed certificate for $IP ..."
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
    -days 3650 -subj "/CN=BoxManage" \
    -addext "subjectAltName=IP:$IP,DNS:localhost"
fi

export TLS_CERT="$CERT_DIR/cert.pem"
export TLS_KEY="$CERT_DIR/key.pem"
export XDG_DATA_HOME=/data/caddy

echo "[boxmanage] Starting Caddy (HTTPS :8090)..."
caddy run --config /app/Caddyfile &
CADDY_PID=$!

trap 'kill $CADDY_PID 2>/dev/null' EXIT INT TERM

echo "[boxmanage] Starting BoxManage server (127.0.0.1:${PORT})..."
exec node /app/src/index.js
