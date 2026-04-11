package api

import (
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Arnab-Afk/hackx/backend/internal/auth"
	"github.com/Arnab-Afk/hackx/backend/internal/chain"
	"github.com/ethereum/go-ethereum/crypto"
)

// deriveVaultKey derives a unique LUKS key for a user from:
//   keccak256(VAULT_MASTER_SECRET + attestation_uid)
//
// Each user gets a different key. Revoke their attestation on-chain
// and they can never re-derive it.
func deriveVaultKey(attestationUID string) (string, error) {
	masterSecret := os.Getenv("VAULT_MASTER_SECRET")
	if masterSecret == "" {
		return "", nil // will be caught by caller
	}
	uid := strings.TrimPrefix(attestationUID, "0x")
	uidBytes, err := hex.DecodeString(uid)
	if err != nil {
		return "", err
	}
	input := append([]byte(masterSecret), uidBytes...)
	hash := crypto.Keccak256(input)
	return hex.EncodeToString(hash), nil
}

// vaultNonce issues a one-time nonce for a wallet to sign.
// GET /vault/nonce?wallet=0x...
func vaultNonce(authMgr *auth.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		wallet := strings.ToLower(r.URL.Query().Get("wallet"))
		if wallet == "" {
			http.Error(w, "wallet required", http.StatusBadRequest)
			return
		}
		nonce := authMgr.IssueNonce(wallet)
		json.NewEncoder(w).Encode(map[string]string{"nonce": nonce})
	}
}

// vaultKey verifies wallet signature + EAS attestation, returns a per-user derived vault key.
// POST /vault/key
// Body: { "wallet": "0x...", "nonce": "zkloud-...", "signature": "0x...", "session_id": "..." }
//
// Flow:
//   1. Verify EIP-191 wallet signature
//   2. Look up attestation for session in DB
//   3. Resolve attestation UID from tx hash (on-chain)
//   4. Check EAS.isAttestationValid(uid) on Base Sepolia
//   5. Derive unique vault key: keccak256(VAULT_MASTER_SECRET + uid)
//   6. Return key — container uses it to unlock LUKS
func (s *Server) vaultKey(authMgr *auth.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Wallet    string `json:"wallet"`
			Nonce     string `json:"nonce"`
			Signature string `json:"signature"`
			SessionID string `json:"session_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}

		// ── 1. Verify EIP-191 wallet signature ───────────────────────────────
		if err := authMgr.VerifySignature(req.Wallet, req.Nonce, req.Signature); err != nil {
			http.Error(w, "signature invalid: "+err.Error(), http.StatusUnauthorized)
			return
		}

		// ── 2. Look up attestation for this session in DB ────────────────────
		att, err := s.store.GetAttestation(r.Context(), req.SessionID)
		if err != nil || att == nil {
			http.Error(w, "no attestation found for session", http.StatusForbidden)
			return
		}

		// ── 3. Get attestation UID (stored at session completion) ────────────
		uid := att.AttestationUID
		if uid == "" {
			// Fallback: resolve from tx hash if UID wasn't stored (old sessions)
			resolved, err := chain.GetAttestationUID(r.Context(), s.rpcURL, att.TxHash)
			if err != nil {
				log.Printf("vault: GetAttestationUID(%s): %v", att.TxHash, err)
				http.Error(w, "attestation UID not yet resolved — try again shortly", http.StatusServiceUnavailable)
				return
			}
			uid = resolved
		}

		// ── 4. Check attestation is still valid on-chain ─────────────────────
		valid, err := chain.IsAttestationValid(r.Context(), s.rpcURL, uid)
		if err != nil {
			log.Printf("vault: IsAttestationValid(%s): %v", uid, err)
			http.Error(w, "on-chain check failed", http.StatusInternalServerError)
			return
		}
		if !valid {
			http.Error(w, "attestation revoked or invalid — access denied", http.StatusForbidden)
			return
		}

		// ── 5. Derive unique vault key for this user ──────────────────────────
		vaultKey, err := deriveVaultKey(uid)
		if err != nil || vaultKey == "" {
			http.Error(w, "VAULT_MASTER_SECRET not configured on server", http.StatusInternalServerError)
			return
		}

		log.Printf("vault: key issued for session=%s uid=%s wallet=%s", req.SessionID, uid, req.Wallet)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"key":             vaultKey,
			"attestation_uid": uid,
			"session_id":      req.SessionID,
		})
	}
}
