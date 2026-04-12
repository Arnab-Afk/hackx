# Container Encryption — Problem & Solution

## The Problem

### Cloud compute requires trusting strangers with your data

When you spin up a VM or container on any cloud provider — AWS, GCP, DigitalOcean — you
hand your code, secrets, and data to an operator you've never met. Their admins have root.
Their disk snapshots capture your filesystem. A misconfigured hypervisor, a rogue employee,
or a subpoena can expose everything inside your container without you ever knowing.

This is the fundamental problem with rented compute: **you pay for the machine but you don't
control who else can see inside it.**

In a decentralized compute network, this problem is worse. The node running your workload
could be anyone's server — a participant you've never vetted, in a jurisdiction you don't
know, with security practices you can't audit.

---

## What Breaks Without Encryption

**Multi-tenant isolation fails at the storage layer.**
Docker namespaces and cgroups isolate processes and network. They do nothing for data at
rest. If two teams share a host, a compromised container or a host-level exploit exposes
everyone's filesystem. `/var/lib/docker/overlay2` is plaintext by default.

**Secrets leak through snapshots and backups.**
`.env` files, API keys, SSH keys, database credentials — they all land on disk in cleartext.
Any backup, snapshot, or disk image taken by the provider captures them verbatim.

**Access outlives intent.**
A terminated workspace leaves its data on disk indefinitely. The provider can read it,
migrate it, or sell the drive. There is no technical mechanism to guarantee data destruction
— only a policy promise.

**No way to prove compute integrity.**
Even if you encrypt, how do you know the agent that ran your deployment did exactly what it
claimed? Without a verifiable record, a malicious or buggy provider can silently substitute
commands, exfiltrate data mid-run, or lie about results.

---

## What This System Does

**Every workspace gets its own LUKS2-encrypted volume.**
The moment a workspace is allocated, a 512MB block device is created, filled with random
bytes, and formatted with AES-256-XTS encryption. The container's home directory lives
entirely inside this encrypted blob. On the host disk, `vault.img` is indistinguishable
from noise — even to the server operator.

**The encryption key is derived from a blockchain attestation, not a password.**
The key is `keccak256(server_secret + attestation_uid)` — where the attestation UID only
exists on Base Sepolia after the AI agent successfully completed the deployment session.
No session → no attestation. No attestation → no key. No key → no data.

**Access is revocable on-chain.**
If an attestation is revoked on-chain, `EAS.isAttestationValid(uid)` returns false. The key
becomes permanently underivable. The encrypted volume becomes permanently unreadable —
without touching the data itself, without running any command on the server. Revocation is
a blockchain transaction, not a request to the provider.

**Every agent action is hashed and attested.**
All tool calls the AI agent made during deployment — every `git clone`, `npm install`,
`start_process` — are hashed, Merkle-rooted, and written to EAS on Base Sepolia. The
attestation is a tamper-evident audit log. You can verify exactly what ran inside your
container before trusting it with sensitive workloads.

---

## Who This Protects Against

| Threat | Protection |
|--------|-----------|
| Rogue compute node operator | LUKS volume is ciphertext even with host root access |
| Compromised neighbouring container | No shared filesystem; each team's volume is isolated |
| Disk snapshot / physical drive theft | `vault.img` is AES-256-XTS — unreadable without the key |
| Stale data after workspace deletion | Revoke attestation on-chain → key permanently gone |
| Malicious or buggy AI agent | Merkle-attested action log → verifiable audit trail |
| Provider subpoena for user data | Provider holds ciphertext — key requires a valid on-chain attestation |

---

## How It Works — Technical Flow

```
AI session completes
       │
       ▼
All agent actions hashed → Merkle root computed
       │
       ▼
EAS attestation submitted on Base Sepolia
       │  attestation_uid stored in DB, linked to session
       ▼
POST /workspaces  { session_id: "sess-xxx" }
       │
       ├── GetAttestation(session_id)  →  attestation_uid
       ├── keccak256(VAULT_MASTER_SECRET + uid)  →  32-byte vault key
       │
       ▼
setupLUKSHome(storageDir, vaultKey)
       │
       ├── dd if=/dev/urandom → vault.img       (512MB, random fill)
       ├── losetup            → /dev/loop3       (attach loop device)
       ├── cryptsetup luksFormat --type luks2    (write LUKS2 header)
       ├── cryptsetup open    → /dev/mapper/zkloud-{rand}
       ├── mkfs.ext4          → format decrypted device
       └── mount              → /vm-storage/workspaces/{team}/home/
       │
       ▼
Docker container created
  bind mount: storageDir/home  →  /home/hackx  (inside container)
       │
       ▼
User SSHs in — sees a normal /home/hackx
Host disk   — vault.img is pure AES-256-XTS ciphertext
```

**On re-open (workspace restart):**
The same `keccak256(secret + uid)` always produces the same key, so the existing volume
can be re-decrypted and mounted. The key is written to a temp file, passed to
`cryptsetup open`, then immediately deleted with `defer os.Remove(keyfile)`.

**On revocation:**
```
chain.IsAttestationValid(uid)  →  false
POST /vault/key                →  403 Forbidden
vault key                      →  permanently underivable
vault.img                      →  permanently unreadable
```
No server command needed. No provider cooperation required.

---

## Key Derivation

```
vaultKey = keccak256( VAULT_MASTER_SECRET || attestation_uid )
```

- `VAULT_MASTER_SECRET` — server-side secret, never exposed via any API
- `attestation_uid` — unique per session, written on-chain by the server after
  the AI agent completes, resolved from the EAS contract on Base Sepolia

Properties:
- **Deterministic** — same session always yields the same key (volume survives restarts)
- **Per-user** — different attestation UID → different key for every workspace
- **Non-extractable** — the server never returns the master secret; only derived keys
  are issued, and only to wallets that can prove they hold a valid attestation

---

## The Core Guarantee

> The compute provider runs your container but cannot read your data.
>
> The blockchain controls who holds the key — not the provider.
>
> Revoke on-chain and access ends permanently, with no cooperation from the provider required.
