#!/bin/bash
set -e

echo "=== Container Encryption Demo ==="
echo ""

# ── Step 1: Build a tiny test image ──────────────────────────────────────────
echo "[1/5] Building test image with a secret inside..."
docker build -t hackx-secret:plain - <<'DOCKERFILE'
FROM alpine:3.19
RUN echo "SECRET_API_KEY=sk-super-secret-123" > /app/secrets.txt && \
    echo "DB_PASSWORD=mysecretpassword" >> /app/secrets.txt
CMD ["cat", "/app/secrets.txt"]
DOCKERFILE

echo "      Done. Proving secret IS visible before encryption:"
docker run --rm hackx-secret:plain
echo ""

# ── Step 2: Generate RSA keypair ─────────────────────────────────────────────
echo "[2/5] Generating RSA keypair for encryption..."
openssl genrsa -out /keys/private.pem 4096 2>/dev/null
openssl rsa -in /keys/private.pem -pubout -out /keys/public.pem 2>/dev/null
echo "      Keys generated: private.pem (keep secret) / public.pem (safe to share)"
echo ""

# ── Step 3: Save image as OCI archive ────────────────────────────────────────
echo "[3/5] Exporting image to OCI archive..."
skopeo copy docker-daemon:hackx-secret:plain oci-archive:/images/plain.tar
echo "      Exported."
echo ""

# ── Step 4: Encrypt the image ────────────────────────────────────────────────
echo "[4/5] Encrypting image layers with public key (JWE/RSA-OAEP)..."
skopeo copy \
  --encryption-key jwe:/keys/public.pem \
  oci-archive:/images/plain.tar \
  oci-archive:/images/encrypted.tar
echo "      Image encrypted."
echo ""

# ── Step 5: Prove the encrypted image is unreadable ──────────────────────────
echo "[5/5] Proving encrypted layers are unreadable:"
echo "      Extracting a layer from the encrypted image..."
LAYER=$(tar -tf /images/encrypted.tar | grep "\.tar.gz\|blobs/sha256" | grep -v manifest | head -1)
echo "      Layer: $LAYER"
echo "      Attempting to read contents (should be garbage):"
tar -xOf /images/encrypted.tar "$LAYER" 2>/dev/null | strings | grep -i "secret\|password\|sk-" || echo "      ✓ Nothing readable — contents are encrypted!"
echo ""
echo "=== Summary ==="
echo "  Plain image size:     $(du -sh /images/plain.tar | cut -f1)"
echo "  Encrypted image size: $(du -sh /images/encrypted.tar | cut -f1)"
echo ""
echo "  To decrypt and run (only you can do this with private.pem):"
echo "    skopeo copy --decryption-key /keys/private.pem \\"
echo "      oci-archive:/images/encrypted.tar docker-daemon:hackx-secret:decrypted"
echo "    docker run --rm hackx-secret:decrypted"
