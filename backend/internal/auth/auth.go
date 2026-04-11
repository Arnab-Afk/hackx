package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// nonceEntry holds a nonce with an expiry.
type nonceEntry struct {
	nonce     string
	expiresAt time.Time
}

// Manager handles nonce issuance and EIP-191 signature verification.
type Manager struct {
	mu     sync.Mutex
	nonces map[string]nonceEntry // key: lowercase address
}

func NewManager() *Manager {
	m := &Manager{nonces: make(map[string]nonceEntry)}
	go m.cleanup()
	return m
}

// IssueNonce generates and stores a fresh nonce for the given address.
// Nonces expire after 5 minutes.
func (m *Manager) IssueNonce(address string) string {
	address = strings.ToLower(address)

	b := make([]byte, 16)
	rand.Read(b)
	nonce := "zkloud-" + hex.EncodeToString(b)

	m.mu.Lock()
	m.nonces[address] = nonceEntry{nonce: nonce, expiresAt: time.Now().Add(5 * time.Minute)}
	m.mu.Unlock()

	return nonce
}

// VerifySignature checks that `signature` is an EIP-191 ("personal_sign") signature
// of `nonce` by `address`. Returns an error if verification fails.
func (m *Manager) VerifySignature(address, nonce, signature string) error {
	address = strings.ToLower(address)

	// Check stored nonce
	m.mu.Lock()
	entry, ok := m.nonces[address]
	m.mu.Unlock()

	if !ok || entry.nonce != nonce {
		return fmt.Errorf("nonce mismatch or not issued for this address")
	}
	if time.Now().After(entry.expiresAt) {
		return fmt.Errorf("nonce expired")
	}

	// Recover the signer from the signature
	recovered, err := recoverAddress(nonce, signature)
	if err != nil {
		return fmt.Errorf("signature recovery failed: %w", err)
	}

	if strings.ToLower(recovered.Hex()) != address {
		return fmt.Errorf("signature signer %s does not match claimed address %s", recovered.Hex(), address)
	}

	// Consume the nonce (one-time use)
	m.mu.Lock()
	delete(m.nonces, address)
	m.mu.Unlock()

	return nil
}

// recoverAddress recovers the Ethereum address that signed `message` with EIP-191
// ("Ethereum Signed Message" prefix), given a 65-byte hex `signature`.
func recoverAddress(message, signature string) (common.Address, error) {
	// EIP-191 prefix
	prefixed := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(prefixed))

	sig, err := hex.DecodeString(strings.TrimPrefix(signature, "0x"))
	if err != nil {
		return common.Address{}, fmt.Errorf("decode signature hex: %w", err)
	}
	if len(sig) != 65 {
		return common.Address{}, fmt.Errorf("invalid signature length: %d (want 65)", len(sig))
	}

	// Normalize v: MetaMask sends v=27/28; go-ethereum expects v=0/1
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	pubKey, err := crypto.SigToPub(hash.Bytes(), sig)
	if err != nil {
		return common.Address{}, err
	}

	return crypto.PubkeyToAddress(*pubKey), nil
}

// cleanup periodically removes expired nonces.
func (m *Manager) cleanup() {
	for range time.Tick(time.Minute) {
		m.mu.Lock()
		for addr, e := range m.nonces {
			if time.Now().After(e.expiresAt) {
				delete(m.nonces, addr)
			}
		}
		m.mu.Unlock()
	}
}
