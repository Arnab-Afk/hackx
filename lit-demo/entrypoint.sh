#!/bin/sh
# Container entrypoint — decrypts secrets via Lit/EAS before starting app.
# If attestation fails, container exits immediately.

echo "[entrypoint] Fetching secrets from Lit Protocol..."
node /app/lit-demo/decrypt.js

if [ $? -ne 0 ]; then
  echo "[entrypoint] Secret decryption failed. Attestation invalid. Exiting."
  exit 1
fi

# Source the decrypted secrets into the environment
export $(cat /app/lit-demo/.env.runtime | xargs)

echo "[entrypoint] Secrets loaded. Starting application..."
exec "$@"
