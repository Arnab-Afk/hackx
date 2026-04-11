#!/bin/bash
set -e

VAULT_IMG="/vault/encryptedfs.img"
VAULT_SIZE=${VAULT_SIZE_MB:-100}
KEYFILE="/run/vault.key"
MAPPER="vault-$(tr -dc 'a-f0-9' < /dev/urandom | head -c 8)"
MOUNT="/private"

echo "[encfs] Starting blockchain-gated encrypted filesystem..."

# ── Require config ────────────────────────────────────────────────────────────
if [ -z "$WALLET_PRIVATE_KEY" ] || [ -z "$BACKEND_URL" ] || [ -z "$SESSION_ID" ]; then
  echo "[encfs] ERROR: WALLET_PRIVATE_KEY, BACKEND_URL, SESSION_ID are required."
  exit 1
fi

# ── Step 1: Derive wallet address from private key ────────────────────────────
echo "[encfs] Deriving wallet address..."
WALLET_ADDRESS=$(node -e "
const { Wallet } = require('ethers');
const w = new Wallet('$WALLET_PRIVATE_KEY');
process.stdout.write(w.address);
")
echo "[encfs] Wallet: $WALLET_ADDRESS"

# ── Step 2: Get nonce from backend ───────────────────────────────────────────
echo "[encfs] Fetching nonce from $BACKEND_URL..."
NONCE=$(curl -sf "$BACKEND_URL/vault/nonce?wallet=$WALLET_ADDRESS" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
  process.stdout.write(JSON.parse(d.join('')).nonce);
});
")
echo "[encfs] Nonce: $NONCE"

# ── Step 3: Sign the nonce with wallet (EIP-191) ──────────────────────────────
echo "[encfs] Signing nonce..."
SIGNATURE=$(node -e "
const { Wallet } = require('ethers');
async function main() {
  const w = new Wallet('$WALLET_PRIVATE_KEY');
  const sig = await w.signMessage('$NONCE');
  process.stdout.write(sig);
}
main();
")

# ── Step 4: Request vault key from backend (checks EAS attestation on-chain) ──
echo "[encfs] Requesting vault key — checking EAS attestation on Base Sepolia..."
RESPONSE=$(curl -sf -X POST "$BACKEND_URL/vault/key" \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$WALLET_ADDRESS\",\"nonce\":\"$NONCE\",\"signature\":\"$SIGNATURE\",\"session_id\":\"$SESSION_ID\"}" \
  2>&1)

if [ $? -ne 0 ]; then
  echo "[encfs] ERROR: Backend rejected key request — attestation invalid or revoked."
  echo "[encfs] Response: $RESPONSE"
  exit 1
fi

VAULT_KEY=$(echo "$RESPONSE" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
  process.stdout.write(JSON.parse(d.join('')).key);
});
")
ATT_UID=$(echo "$RESPONSE" | node -e "
const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{
  process.stdout.write(JSON.parse(d.join('')).attestation_uid||'');
});
")
echo "[encfs] Attestation verified on-chain: $ATT_UID"
echo "[encfs] Vault key received."

# ── Step 5: Use key to unlock LUKS ────────────────────────────────────────────
echo -n "$VAULT_KEY" > "$KEYFILE"
chmod 600 "$KEYFILE"
mkdir -p /vault "$MOUNT"

for old in $(ls /dev/mapper/vault-* 2>/dev/null); do
  cryptsetup close "${old##*/}" 2>/dev/null || true
done

LOOP=$(losetup -f)

if [ ! -f "$VAULT_IMG" ]; then
  echo "[encfs] Creating ${VAULT_SIZE}MB encrypted volume..."
  dd if=/dev/urandom of="$VAULT_IMG" bs=1M count="$VAULT_SIZE" 2>/dev/null
  losetup "$LOOP" "$VAULT_IMG"
  cryptsetup luksFormat --batch-mode --key-file "$KEYFILE" --type luks2 "$LOOP"
  cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER"
  mkfs.ext4 -q /dev/mapper/"$MAPPER"
  mount /dev/mapper/"$MAPPER" "$MOUNT"
  cp -r /app-staging/* "$MOUNT"/
  sync
  echo "[encfs] App files encrypted at rest."
else
  echo "[encfs] Unlocking existing encrypted volume..."
  losetup "$LOOP" "$VAULT_IMG"
  if ! cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER" 2>/dev/null; then
    rm -f "$KEYFILE"
    echo "[encfs] Wrong key — access denied."
    exit 1
  fi
  mount /dev/mapper/"$MAPPER" "$MOUNT"
fi

rm -f "$KEYFILE"
rm -rf /app-staging
echo "[encfs] Key wiped. Vault sealed. App running from encrypted FS."
echo ""
exec node "$MOUNT/index.js"
