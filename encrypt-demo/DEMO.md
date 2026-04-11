# Encrypted Container Filesystem Demo

## Overview

This demo shows how to run a live application (Express.js) inside a Docker container where **all source code and secrets are encrypted on disk using LUKS (Linux Unified Key Setup)**. The server owner cannot read your files even with full access to the disk image.

---

## How It Works

```
VAULT_KEY (provided at startup)
        │
        ▼
LUKS unlock ──► /dev/mapper/vault-<random>
        │
        ▼
ext4 filesystem mounted at /private/     ← app runs from here
   ├── index.js                          ← your source code
   ├── package.json
   └── node_modules/

        ↕  transparent AES-256 encryption

/vault/encryptedfs.img                   ← raw disk: unreadable cipher text
```

- Files written to `/private` are transparently encrypted to `/vault/encryptedfs.img`
- The raw `.img` file contains only cipher text — no readable strings
- After mount, the key is wiped from disk — only lives in kernel memory
- If the container stops, the vault locks automatically
- On restart, the same `VAULT_KEY` re-mounts the same data

---

## Project Structure

```
encrypt-demo/
├── Dockerfile.express-encfs     # Docker image definition
├── entrypoint-express.sh        # Startup script: LUKS setup + app launch
├── express-app/
│   ├── index.js                 # Express app (gets encrypted at startup)
│   ├── package.json
│   └── node_modules/
├── keys/
│   ├── private.pem              # RSA private key (image layer encryption)
│   └── public.pem               # RSA public key
└── images/
    ├── plain.tar                # Unencrypted OCI image archive
    └── encrypted.tar            # Encrypted OCI image archive
```

---

## Part 1 — Image Layer Encryption (skopeo)

This encrypts the Docker **image layers** so the image on disk/registry is unreadable without your private key.

### Generate RSA keypair

```bash
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### Build and export the image

```bash
docker build -t hackx-secret:plain .
docker save hackx-secret:plain -o images/plain-docker.tar
```

### Encrypt the image layers

```bash
docker run --rm \
  -v "$(pwd)/keys:/keys" \
  -v "$(pwd)/images:/images" \
  alpine:3.19 sh -c '
    apk add --no-cache skopeo > /dev/null 2>&1
    skopeo copy docker-archive:/images/plain-docker.tar oci-archive:/images/plain.tar
    skopeo copy \
      --encryption-key jwe:/keys/public.pem \
      oci-archive:/images/plain.tar \
      oci-archive:/images/encrypted.tar
    echo "Encrypted."
  '
```

### Decrypt and load back

```bash
docker run --rm \
  -v "$(pwd)/keys:/keys" \
  -v "$(pwd)/images:/images" \
  alpine:3.19 sh -c '
    apk add --no-cache skopeo > /dev/null 2>&1
    skopeo copy \
      --decryption-key /keys/private.pem \
      oci-archive:/images/encrypted.tar \
      docker-archive:/images/decrypted-docker.tar:hackx-secret:decrypted
  '
docker load -i images/decrypted-docker.tar
```

### What this protects

| Threat | Protected? |
|---|---|
| Image layers on disk | Yes — AES encrypted |
| Registry contents | Yes — encrypted blob |
| Running container memory | No |
| Dockerfile build history | **No** — RUN commands are visible in manifest |

> **Important:** Never write secrets in `RUN echo ...` commands — they appear in the image manifest even after layer encryption. Inject secrets at runtime via env vars or mounted files.

---

## Part 2 — Live Encrypted Filesystem (LUKS)

This encrypts the **running container's filesystem** using a LUKS-encrypted loop device. The app runs normally from `/private` while the underlying disk block (`encryptedfs.img`) is pure cipher text.

### The Express App (`express-app/index.js`)

```js
const express = require('express');
const app = express();

const SECRET_LOGIC = "this code is encrypted on disk — you cannot read this file";
const DB_URL = process.env.DATABASE_URL || "not set";

app.get('/', (req, res) => {
  res.json({ message: 'Running from encrypted filesystem', status: 'ok' });
});

app.get('/secret', (req, res) => {
  res.json({ secret: SECRET_LOGIC, db: DB_URL });
});

app.listen(3000, () => console.log('[app] Express running on :3000 from encrypted FS'));
```

### The Dockerfile (`Dockerfile.express-encfs`)

```dockerfile
FROM node:20-alpine AS base

RUN apk add --no-cache cryptsetup e2fsprogs util-linux bash

COPY entrypoint-express.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# App staged here — moved into encrypted volume at startup
COPY express-app /app-staging/

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
```

### The Entrypoint (`entrypoint-express.sh`)

```bash
#!/bin/bash
set -e

VAULT_IMG="/vault/encryptedfs.img"
VAULT_SIZE=${VAULT_SIZE_MB:-100}
KEYFILE="/run/vault.key"
MAPPER="vault-$(tr -dc 'a-f0-9' < /dev/urandom | head -c 8)"
MOUNT="/private"

# Refuse to start without a key
if [ -z "$VAULT_KEY" ]; then
  echo "[encfs] ERROR: VAULT_KEY not set. Refusing to start."
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
  # First run — create encrypted volume
  dd if=/dev/urandom of="$VAULT_IMG" bs=1M count="$VAULT_SIZE" 2>/dev/null
  losetup "$LOOP" "$VAULT_IMG"
  cryptsetup luksFormat --batch-mode --key-file "$KEYFILE" --type luks2 "$LOOP"
  cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER"
  mkfs.ext4 -q /dev/mapper/"$MAPPER"
  mount /dev/mapper/"$MAPPER" "$MOUNT"
  cp -r /app-staging/* "$MOUNT"/
  sync
else
  # Subsequent runs — unlock and mount existing volume
  losetup "$LOOP" "$VAULT_IMG"
  if ! cryptsetup open --key-file "$KEYFILE" "$LOOP" "$MAPPER" 2>/dev/null; then
    rm -f "$KEYFILE"
    echo "[encfs] Wrong key — access denied."
    exit 1
  fi
  mount /dev/mapper/"$MAPPER" "$MOUNT"
fi

# Wipe key immediately after mount
rm -f "$KEYFILE"

# Delete plaintext staged files — only encrypted copy remains
rm -rf /app-staging

exec node "$MOUNT/index.js"
```

### Build the image

```bash
docker build \
  -f Dockerfile.express-encfs \
  -t hackx-express-encfs:latest \
  .
```

### Run the container

```bash
docker run -d --name hackx-express \
  --privileged \
  -e VAULT_KEY="my-secret-encryption-key" \
  -e VAULT_SIZE_MB=100 \
  -e DATABASE_URL="postgres://zkloud:zkloud@localhost:5432/zkloud" \
  -v hackx-express-vault:/vault \
  -p 3000:3000 \
  hackx-express-encfs:latest
```

> **`--privileged`** is required for LUKS (`cryptsetup`) and loop device access.
> On a real server, replace with `--cap-add SYS_ADMIN --cap-add MKNOD`.

### Verify it works

```bash
# API is live
curl http://localhost:3000/
# → {"message":"Running from encrypted filesystem","status":"ok"}

curl http://localhost:3000/secret
# → {"secret":"this code is encrypted on disk...","db":"postgres://..."}
```

### Prove the filesystem is encrypted

Inside the container (`docker exec -it hackx-express sh`):

```sh
# Source files are gone — deleted after copying to encrypted volume
ls /app-staging
# → ls: /app-staging: No such file or directory

# Raw disk image contains no readable strings
strings /vault/encryptedfs.img | grep -i "express\|secret\|DATABASE"
# → (empty — nothing found)

# App is running from the decrypted mount
ls /private/
# → index.js  node_modules  package.json  package-lock.json
```

### What this protects

| Threat | Protected? |
|---|---|
| Raw disk image stolen | Yes — pure cipher text |
| Docker volume inspected | Yes — encrypted blob |
| `docker inspect` for secrets | Partially — VAULT_KEY visible in env |
| Running container exec | No — files visible at `/private` while running |
| Container stopped + restarted without key | Yes — vault stays locked |

---

## Part 3 — What's Missing: Blockchain Key Gate

Currently `VAULT_KEY` is passed as a plain env var. Anyone running `docker inspect hackx-express` can see it.

**The next step** is to replace the env var with a blockchain-gated key release:

```
entrypoint-express.sh
        │
        │  instead of reading VAULT_KEY from env
        │
        ▼
  Wallet signs a message → calls backend /vault/key
        │
        ▼
  backend checks EAS attestation on Base Sepolia
  (using existing chain/eas.go)
        │
   valid attestation → returns VAULT_KEY → LUKS unlocks → app starts
   no attestation    → 401 → container exits
```

This means:
- No key in env vars
- No key on disk
- Key only released to wallets with a valid EAS attestation on Base Sepolia
- Revoke the attestation → container can never unlock again

---

## Cleanup

```bash
# Stop and remove containers
docker rm -f hackx-express hackx-plain hackx-decrypted

# Remove volumes
docker volume rm hackx-express-vault

# Free stale loop devices (if needed)
docker run --rm --privileged alpine:3.19 sh -c "
  apk add --no-cache util-linux cryptsetup > /dev/null 2>&1
  for m in \$(ls /dev/mapper/vault-* 2>/dev/null); do
    cryptsetup close \"\${m##*/}\" 2>/dev/null || true
  done
  for dev in /dev/loop2 /dev/loop3 /dev/loop4 /dev/loop5 /dev/loop6 /dev/loop7; do
    losetup -d \$dev 2>/dev/null || true
  done
"
```
