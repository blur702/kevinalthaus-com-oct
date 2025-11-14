#!/bin/bash
# Generate a development CA plus PostgreSQL server certificate/key pair.
# Usage: ./scripts/generate-ssl-certs.sh

set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-./secrets}"
CA_KEY="$SECRETS_DIR/ca.key"
CA_CERT="$SECRETS_DIR/ca.crt"
SERVER_KEY="$SECRETS_DIR/server.key"
SERVER_CERT="$SECRETS_DIR/server.crt"
SERVER_CSR="$SECRETS_DIR/server.csr"
SERIAL_FILE="$SECRETS_DIR/ca.srl"

log() {
  echo "[ssl] $*"
}

log "Preparing SSL materials under $SECRETS_DIR"
mkdir -p "$SECRETS_DIR"

if [ -f "$SERVER_CERT" ] && [ -f "$SERVER_KEY" ] && [ -f "$CA_CERT" ]; then
  log "Existing server.crt, server.key, and ca.crt detected. No changes made."
  exit 0
fi

if [ -f "$SERVER_CERT" ] && [ -f "$SERVER_KEY" ] && [ ! -f "$CA_CERT" ]; then
  log "server.crt and server.key already exist but ca.crt is missing."
  log "Provide the CA certificate that signed server.crt (or remove the server files to regenerate)."
  exit 1
fi

if [ ! -f "$CA_KEY" ] || [ ! -f "$CA_CERT" ]; then
  log "Generating development certificate authority (ca.key / ca.crt)..."
  openssl genrsa -out "$CA_KEY" 4096 1>/dev/null
  openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 825 \
    -out "$CA_CERT" -subj "/CN=kevinalthaus-postgres-ca/O=Kevinalthaus Dev/C=US" 1>/dev/null
  chmod 600 "$CA_KEY"
  chmod 644 "$CA_CERT"
fi

log "Generating PostgreSQL server key and certificate signed by local CA..."
openssl genrsa -out "$SERVER_KEY" 4096 1>/dev/null

OPENSSL_CONFIG=$(mktemp)
cat >"$OPENSSL_CONFIG" <<'EOF'
[ req ]
default_bits = 4096
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[ dn ]
CN = postgres
O = Kevinalthaus Dev
C = US

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = postgres
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -new -key "$SERVER_KEY" -out "$SERVER_CSR" -config "$OPENSSL_CONFIG" 1>/dev/null
openssl x509 -req -in "$SERVER_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
  -out "$SERVER_CERT" -days 825 -sha256 -extensions req_ext -extfile "$OPENSSL_CONFIG" 1>/dev/null

chmod 600 "$SERVER_KEY"
chmod 644 "$SERVER_CERT"

rm -f "$SERVER_CSR" "$OPENSSL_CONFIG"
[ -f "$SERIAL_FILE" ] && chmod 600 "$SERIAL_FILE"

log "SSL assets generated successfully:"
log "  CA certificate : $CA_CERT"
log "  Server cert     : $SERVER_CERT"
log "  Server key      : $SERVER_KEY"
log ""
log "Use these files for local testing only. Replace with CA-signed assets in production."
