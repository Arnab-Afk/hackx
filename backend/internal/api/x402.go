package api

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	gethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/Arnab-Afk/hackx/backend/internal/chain"
	"github.com/Arnab-Afk/hackx/backend/internal/store"
)

// x402PaymentRequired is the body returned when payment is missing.
// Follows the x402 spec (https://x402.org).
type x402PaymentRequired struct {
	X402Version int            `json:"x402Version"`
	Error       string         `json:"error"`
	Accepts     []x402Accepts  `json:"accepts"`
}

type x402Accepts struct {
	Scheme            string         `json:"scheme"`
	Network           string         `json:"network"`
	MaxAmountRequired string         `json:"maxAmountRequired"` // USDC micro-units (6 decimals)
	Resource          string         `json:"resource"`
	Description       string         `json:"description"`
	MimeType          string         `json:"mimeType"`
	PayTo             string         `json:"payTo"`
	MaxTimeoutSeconds int            `json:"maxTimeoutSeconds"`
	Asset             string         `json:"asset"`
	Extra             map[string]any `json:"extra"`
}

// x402PaymentHeader is what the client sends in X-PAYMENT (base64-encoded JSON).
type x402PaymentHeader struct {
	Scheme  string          `json:"scheme"`
	Network string          `json:"network"`
	Payload x402Payload     `json:"payload"`
}

type x402Payload struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`        // USDC micro-units as decimal string
	ValidAfter  string `json:"validAfter"`
	ValidBefore string `json:"validBefore"`
	Nonce       string `json:"nonce"`        // 32-byte hex (0x-prefixed)
	V           uint8  `json:"v"`
	R           string `json:"r"`            // 32-byte hex (0x-prefixed)
	S           string `json:"s"`            // 32-byte hex (0x-prefixed)
}

// usedNonces prevents replay attacks on the same USDC authorization.
var usedNonces sync.Map // key: nonce hex string → expiry time.Time

// x402Middleware returns middleware that requires x402 USDC payment on protected routes.
//
//   - providerWallet: the wallet that must be the `to` field of the payment
//   - requiredUsdc:   minimum payment in USDC micro-units (e.g. 10000 = 0.01 USDC)
//   - rpcURL:         Base Sepolia RPC endpoint
//   - agentPrivKey:   private key of the agent wallet (pays gas for transferWithAuthorization)
//   - storeRef:       optional store for persisting payment records (may be nil)
//
// STELLAR INTEGRATION POINT
// Future: Replace x402 X-PAYMENT header validation with Stellar escrow when
// STELLAR_MODE=true is set in config.
//
//  When using the Stellar payment layer:
//   1. Check X-STELLAR-SESSION header for a valid session_id
//   2. Call stellar/scripts/init_escrow.ts to lock USDC in the Soroban contract
//   3. Skip the EIP-3009 transferWithAuthorization logic below
//
// The Soroban DeploymentSession serves the same guarantee as the x402 payment
// receipt: provider is ensured payment before doing any work.
// See: stellar/scripts/init_escrow.ts and stellar/docs/architecture.md
func x402Middleware(providerWallet string, requiredUsdc *big.Int, rpcURL, agentPrivKey string, storeRef *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			paymentHeader := r.Header.Get("X-PAYMENT")

			if paymentHeader == "" {
				// Return 402 with payment requirements
				body := x402PaymentRequired{
					X402Version: 1,
					Error:       "Payment Required",
					Accepts: []x402Accepts{{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: requiredUsdc.String(),
						Resource:          r.URL.Path,
						Description:       "zkLOUD compute provisioning — 0.01 USDC per session",
						MimeType:          "application/json",
						PayTo:             providerWallet,
						MaxTimeoutSeconds: 300,
						Asset:             chain.USDCAddress,
						Extra:             map[string]any{"name": "USD Coin", "version": "2"},
					}},
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusPaymentRequired)
				json.NewEncoder(w).Encode(body)
				return
			}

			// Decode the payment header (base64 JSON)
			auth, err := decodePaymentHeader(paymentHeader)
			if err != nil {
				http.Error(w, fmt.Sprintf("invalid X-PAYMENT header: %v", err), http.StatusBadRequest)
				return
			}

			// Validate network
			if !strings.EqualFold(auth.Network, "base-sepolia") {
				http.Error(w, "X-PAYMENT: wrong network (expected base-sepolia)", http.StatusBadRequest)
				return
			}

			// Validate `to` matches our wallet
			if !strings.EqualFold(auth.Payload.To, providerWallet) {
				http.Error(w, fmt.Sprintf("X-PAYMENT: payment must go to %s", providerWallet), http.StatusBadRequest)
				return
			}

			// Validate amount
			value, ok := new(big.Int).SetString(auth.Payload.Value, 10)
			if !ok {
				http.Error(w, "X-PAYMENT: invalid value field", http.StatusBadRequest)
				return
			}
			if value.Cmp(requiredUsdc) < 0 {
				http.Error(w, fmt.Sprintf("X-PAYMENT: amount %s < required %s", value, requiredUsdc), http.StatusPaymentRequired)
				return
			}

			// Validate expiry
			validBefore, _ := new(big.Int).SetString(auth.Payload.ValidBefore, 10)
			if validBefore.Int64() < time.Now().Unix() {
				http.Error(w, "X-PAYMENT: authorization expired", http.StatusBadRequest)
				return
			}

			// Replay protection
			nonceKey := strings.ToLower(auth.Payload.Nonce)
			if _, seen := usedNonces.Load(nonceKey); seen {
				http.Error(w, "X-PAYMENT: nonce already used", http.StatusBadRequest)
				return
			}

			// Build TransferAuth for verification
			ta, err := buildTransferAuth(auth.Payload)
			if err != nil {
				http.Error(w, fmt.Sprintf("X-PAYMENT: parse error: %v", err), http.StatusBadRequest)
				return
			}

			// Verify EIP-712 signature
			if err := chain.VerifyTransferAuth(ta); err != nil {
				http.Error(w, fmt.Sprintf("X-PAYMENT: signature invalid: %v", err), http.StatusUnauthorized)
				return
			}

			// Mark nonce used immediately (before submitting tx to prevent races)
			usedNonces.Store(nonceKey, time.Now().Add(24*time.Hour))

			// Submit transferWithAuthorization on-chain in the background.
			// We don't block the request on tx mining — the money is locked by the
			// authorization signature; the provider node captures it asynchronously.
			if agentPrivKey != "" && rpcURL != "" {
				go func() {
					txHash, err := chain.SubmitTransferWithAuthorization(
						context.Background(), rpcURL, agentPrivKey, ta,
					)
					if err != nil {
						log.Printf("[x402] USDC transfer submission failed: %v", err)
					} else {
						log.Printf("[x402] USDC transfer submitted: tx=%s from=%s value=%s", txHash, ta.From.Hex(), value.String())
						// Persist the payment record
						if storeRef != nil {
							_ = storeRef.SavePayment(context.Background(), &store.Payment{
								Wallet:     strings.ToLower(ta.From.Hex()),
								AmountUSDC: value.String(),
								TxHash:     txHash,
								Nonce:      auth.Payload.Nonce,
								Status:     "confirmed",
							})
						}
					}
				}()
			}

			// Allow the request through
			next.ServeHTTP(w, r)
		})
	}
}

func decodePaymentHeader(raw string) (*x402PaymentHeader, error) {
	// Try plain JSON first, then base64-encoded JSON
	var header x402PaymentHeader
	if err := json.Unmarshal([]byte(raw), &header); err == nil {
		return &header, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(raw)
		if err != nil {
			return nil, fmt.Errorf("not valid JSON or base64")
		}
	}
	if err := json.Unmarshal(decoded, &header); err != nil {
		return nil, fmt.Errorf("JSON decode: %w", err)
	}
	return &header, nil
}

func buildTransferAuth(p x402Payload) (chain.TransferAuth, error) {
	var ta chain.TransferAuth

	ta.From = gethcommon.HexToAddress(p.From)
	ta.To = gethcommon.HexToAddress(p.To)

	value, ok := new(big.Int).SetString(p.Value, 10)
	if !ok {
		return ta, fmt.Errorf("invalid value: %s", p.Value)
	}
	ta.Value = value

	validAfter, _ := new(big.Int).SetString(p.ValidAfter, 10)
	ta.ValidAfter = validAfter

	validBefore, _ := new(big.Int).SetString(p.ValidBefore, 10)
	ta.ValidBefore = validBefore

	nonce, err := hexToBytes32(p.Nonce)
	if err != nil {
		return ta, fmt.Errorf("nonce: %w", err)
	}
	ta.Nonce = nonce

	ta.V = p.V

	r, err := hexToBytes32(p.R)
	if err != nil {
		return ta, fmt.Errorf("r: %w", err)
	}
	ta.R = r

	s, err := hexToBytes32(p.S)
	if err != nil {
		return ta, fmt.Errorf("s: %w", err)
	}
	ta.S = s

	return ta, nil
}

func hexToBytes32(h string) ([32]byte, error) {
	h = strings.TrimPrefix(h, "0x")
	b, err := hex.DecodeString(h)
	if err != nil {
		return [32]byte{}, err
	}
	var out [32]byte
	copy(out[32-len(b):], b)
	return out, nil
}
