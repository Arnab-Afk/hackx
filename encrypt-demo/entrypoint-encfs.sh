#!/bin/bash
set -e

VAULT_IMG="/vault/encryptedfs.img"
VAULT_SIZE=${VAULT_SIZE_MB:-200}
KEYFILE="/run/vault.key"
MAPPER="vault-$(tr -dc 'a-f0-9' < /dev/urandom | head -c 8)"
MOUNT="/private"

echo "[encfs] Starting encrypted filesystem setup..."

# ── Key: from env var or fail ─────────────────────────────────────────────────
if [ -z "$VAULT_KEY" ]; then
  echo "[encfs] ERROR: VAULT_KEY not set. Container will not start."
  exit 1
fi
echo -n "$VAULT_KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"

mkdir -p /vault "$MOUNT"

# Close any leftover mappers from previous runs
for old in $(ls /dev/mapper/vault-* 2>/dev/null); do
  cryptsetup close "${old##*/}" 2>/dev/null || true
done

LOOP=$(losetup -f)

if [ ! -f "$VAULT_IMG" ]; then
  # ── Fresh setup ──────────────────────────────────────────────────────────────
  echo "[encfs] Creating new ${VAULT_SIZE}MB encrypted volume..."
  dd if=/dev/urandom of="$VAULT_IMG" bs=1M count="$VAULT_SIZE" 2>/dev/null

  losetup "$LOOP" "$VAULT_IMG"
  echo "[encfs] Formatting LUKS..."
  cryptsetup luksFormat --batch-mode --key-file "$KEYFILE" --type luks2 "$LOOP"
  cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER"
  echo "[encfs] Formatting ext4..."
  mkfs.ext4 -q /dev/mapper/"$MAPPER"
  mount /dev/mapper/"$MAPPER" "$MOUNT"

  echo "[encfs] Copying app files into encrypted volume..."
  cp -r /app-staging/* "$MOUNT"/
  sync
  echo "[encfs] App files are now encrypted at rest."
else
  # ── Reuse existing encrypted volume ──────────────────────────────────────────
  echo "[encfs] Reusing existing encrypted volume..."
  losetup "$LOOP" "$VAULT_IMG"
  if ! cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER" 2>/dev/null; then
    rm -f "$KEYFILE"
    echo "[encfs] ERROR: Wrong key — access denied."
    exit 1
  fi
  if ! mount /dev/mapper/"$MAPPER" "$MOUNT" 2>/dev/null; then
    echo "[encfs] Mount failed — reformatting (first run after key change)..."
    mkfs.ext4 -q /dev/mapper/"$MAPPER"
    mount /dev/mapper/"$MAPPER" "$MOUNT"
    cp -r /app-staging/* "$MOUNT"/
    sync
  fi
fi

# ── Wipe key from disk ────────────────────────────────────────────────────────
rm -f "$KEYFILE"
echo "[encfs] Key wiped from disk."

echo "[encfs] Encrypted FS mounted at $MOUNT"
echo "[encfs] Contents:"
ls "$MOUNT"/
echo ""
echo "[encfs] Starting app from encrypted volume..."
exec "$MOUNT/server"
