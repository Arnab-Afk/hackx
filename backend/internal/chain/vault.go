package chain

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	gethcommon "github.com/ethereum/go-ethereum/common"
)

// IsAttestationValid calls EAS.isAttestationValid(uid) on Base Sepolia.
// uid must be a 0x-prefixed hex bytes32 string (the attestation UID, not the schema UID).
func IsAttestationValid(ctx context.Context, rpcURL, attestationUID string) (bool, error) {
	const abiJSON = `[{
		"name": "isAttestationValid",
		"type": "function",
		"stateMutability": "view",
		"inputs": [{"name": "uid", "type": "bytes32"}],
		"outputs": [{"name": "", "type": "bool"}]
	}]`

	parsed, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		return false, fmt.Errorf("parse abi: %w", err)
	}

	uidBytes, err := hex.DecodeString(strings.TrimPrefix(attestationUID, "0x"))
	if err != nil {
		return false, fmt.Errorf("decode uid: %w", err)
	}
	var uid32 [32]byte
	copy(uid32[:], uidBytes)

	calldata, err := parsed.Pack("isAttestationValid", uid32)
	if err != nil {
		return false, fmt.Errorf("pack calldata: %w", err)
	}

	type ethCallParams struct {
		To   string `json:"to"`
		Data string `json:"data"`
	}

	client := newRPCClient(rpcURL)
	result, err := client.call(ctx, "eth_call", ethCallParams{
		To:   EASContractAddress,
		Data: "0x" + hex.EncodeToString(calldata),
	}, "latest")
	if err != nil {
		return false, fmt.Errorf("eth_call: %w", err)
	}

	var hexResult string
	if err := json.Unmarshal(result, &hexResult); err != nil {
		return false, fmt.Errorf("decode result: %w", err)
	}

	decoded, err := parsed.Unpack("isAttestationValid", gethcommon.FromHex(hexResult))
	if err != nil {
		return false, fmt.Errorf("unpack result: %w", err)
	}
	if len(decoded) == 0 {
		return false, nil
	}
	valid, ok := decoded[0].(bool)
	if !ok {
		return false, fmt.Errorf("unexpected return type")
	}
	return valid, nil
}

// WaitForAttestationUID polls for the tx receipt until mined (up to 90s) then
// returns the attestation UID from the Attested event log.
func WaitForAttestationUID(ctx context.Context, rpcURL, txHash string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	client := newRPCClient(rpcURL)
	for {
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("timeout waiting for tx %s to be mined", txHash)
		default:
		}

		result, err := client.call(ctx, "eth_getTransactionReceipt", txHash)
		if err == nil && string(result) != "null" {
			// receipt available — delegate to GetAttestationUID
			return GetAttestationUID(ctx, rpcURL, txHash)
		}
		// not mined yet — wait 3s and retry
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("timeout waiting for tx %s to be mined", txHash)
		case <-time.After(3 * time.Second):
		}
	}
}

// GetAttestationUID fetches the attestation UID emitted in the Attested event
// from a confirmed transaction receipt.
func GetAttestationUID(ctx context.Context, rpcURL, txHash string) (string, error) {
	// Attested(bytes32 indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema)
	// topic0 = keccak256("Attested(address,address,bytes32,bytes32)")
	const attestedTopic = "0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35"

	client := newRPCClient(rpcURL)
	result, err := client.call(ctx, "eth_getTransactionReceipt", txHash)
	if err != nil {
		return "", fmt.Errorf("eth_getTransactionReceipt: %w", err)
	}

	var receipt struct {
		Logs []struct {
			Topics []string `json:"topics"`
			Data   string   `json:"data"`
		} `json:"logs"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(result, &receipt); err != nil {
		return "", fmt.Errorf("decode receipt: %w", err)
	}
	if receipt.Status != "0x1" {
		return "", fmt.Errorf("transaction failed (status=%s)", receipt.Status)
	}

	for _, log := range receipt.Logs {
		if len(log.Topics) >= 1 && strings.EqualFold(log.Topics[0], attestedTopic) {
			// EAS Attested event: uid is NOT indexed — it's the first 32 bytes of data
			// event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema)
			if len(log.Data) >= 66 {
				return "0x" + log.Data[2:66], nil
			}
		}
	}
	return "", fmt.Errorf("Attested event not found in tx %s", txHash)
}
