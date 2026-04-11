package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Arnab-Afk/hackx/backend/internal/auth"
	"github.com/Arnab-Afk/hackx/backend/internal/chain"
)

// vaultNonce issues a nonce for a wallet to sign.
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

// vaultKey verifies a wallet signature + EAS attestation, returns VAULT_KEY.
// POST /vault/key
// Body: { "wallet": "0x...", "nonce": "zkloud-...", "signature": "0x...", "session_id": "..." }
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

		// ── 3. Resolve attestation UID from the tx hash ──────────────────────
		uid, err := chain.GetAttestationUID(r.Context(), s.rpcURL, att.TxHash)
		if err != nil {
			log.Printf("vault: GetAttestationUID(%s): %v", att.TxHash, err)
			http.Error(w, "could not resolve attestation UID", http.StatusInternalServerError)
			return
		}

		// ── 4. Verify attestation is still valid on-chain ────────────────────
		valid, err := chain.IsAttestationValid(r.Context(), s.rpcURL, uid)
		if err != nil {
			log.Printf("vault: IsAttestationValid(%s): %v", uid, err)
			http.Error(w, "on-chain check failed", http.StatusInternalServerError)
			return
		}
		if !valid {
			http.Error(w, "attestation revoked or invalid", http.StatusForbidden)
			return
		}

		// ── 5. Return the vault key ──────────────────────────────────────────
		vaultKey := os.Getenv("VAULT_KEY")
		if vaultKey == "" {
			http.Error(w, "vault key not configured on server", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"key":            vaultKey,
			"attestation_uid": uid,
		})
	}
}
