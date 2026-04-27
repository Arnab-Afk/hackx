package chain

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	gethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// EAS contract address on Base Sepolia (predeploy)
const EASContractAddress = "0x4200000000000000000000000000000000000021"

// AttestationRequest matches the EAS on-chain struct.
type AttestationRequest struct {
	Schema gethcommon.Hash
	Data   AttestationRequestData
}

type AttestationRequestData struct {
	Recipient    gethcommon.Address
	ExpirationTime uint64
	Revocable    bool
	RefUID       gethcommon.Hash
	Data         []byte
	Value        *big.Int
}

// AttestationResult is what we return after submitting.
type AttestationResult struct {
	TxHash string `json:"tx_hash"`
	// UID is not known until the tx is mined; caller can poll later.
}

// easAttestABI is the ABI for EAS.attest()
var easAttestABI abi.ABI

func init() {
	const abiJSON = `[{
		"name": "attest",
		"type": "function",
		"stateMutability": "payable",
		"inputs": [{
			"name": "request",
			"type": "tuple",
			"components": [
				{"name": "schema", "type": "bytes32"},
				{"name": "data", "type": "tuple", "components": [
					{"name": "recipient",       "type": "address"},
					{"name": "expirationTime", "type": "uint64"},
					{"name": "revocable",       "type": "bool"},
					{"name": "refUID",          "type": "bytes32"},
					{"name": "data",            "type": "bytes"},
					{"name": "value",           "type": "uint256"}
				]}
			]
		}],
		"outputs": [{"name": "", "type": "bytes32"}]
	}]`

	var err error
	easAttestABI, err = abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		panic(fmt.Sprintf("chain: invalid EAS ABI: %v", err))
	}
}

// SubmitAttestation signs and submits an EAS attest() transaction.
// privateKeyHex must be a hex-encoded secp256k1 private key (with or without 0x prefix).
// Returns the tx hash on success.
func SubmitAttestation(ctx context.Context, rpcURL, privateKeyHex, schemaUID string, sessionID, teamID string, actionMerkleRoot, containerStateHash [32]byte, ipfsCID string) (*AttestationResult, error) {
	client := newRPCClient(rpcURL)

	// --- private key ---
	privKeyHex := strings.TrimPrefix(privateKeyHex, "0x")
	privKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	fromAddr := crypto.PubkeyToAddress(privKey.PublicKey)

	// --- chain ID (Base Sepolia = 84532) ---
	chainID := big.NewInt(84532)

	// --- nonce ---
	nonceResult, err := client.call(ctx, "eth_getTransactionCount", fromAddr.Hex(), "latest")
	if err != nil {
		return nil, fmt.Errorf("get nonce: %w", err)
	}
	var nonceHex string
	if err := json.Unmarshal(nonceResult, &nonceHex); err != nil {
		return nil, fmt.Errorf("decode nonce: %w", err)
	}
	nonce, _ := new(big.Int).SetString(strings.TrimPrefix(nonceHex, "0x"), 16)

	// --- gas price ---
	gasPriceResult, err := client.call(ctx, "eth_gasPrice")
	if err != nil {
		return nil, fmt.Errorf("get gas price: %w", err)
	}
	var gasPriceHex string
	if err := json.Unmarshal(gasPriceResult, &gasPriceHex); err != nil {
		return nil, fmt.Errorf("decode gas price: %w", err)
	}
	gasPrice, _ := new(big.Int).SetString(strings.TrimPrefix(gasPriceHex, "0x"), 16)

	// --- build attestation data (ABI-encoded inner bytes) ---
	// Schema: bytes32 teamId, bytes32 actionMerkleRoot, bytes32 containerStateHash, string sessionId, string ipfsCid
	var teamIDBuf [32]byte
	copy(teamIDBuf[:], crypto.Keccak256([]byte(teamID)))

	innerABI, _ := abi.JSON(strings.NewReader(`[{"name":"f","type":"function","inputs":[
		{"name":"teamId","type":"bytes32"},
		{"name":"actionMerkleRoot","type":"bytes32"},
		{"name":"containerStateHash","type":"bytes32"},
		{"name":"sessionId","type":"string"},
		{"name":"ipfsCid","type":"string"}
	],"outputs":[]}]`))
	innerData, err := innerABI.Pack("f", teamIDBuf, actionMerkleRoot, containerStateHash, sessionID, ipfsCID)
	if err != nil {
		return nil, fmt.Errorf("pack attestation data: %w", err)
	}
	// Pack adds a 4-byte selector prefix; strip it so we have pure ABI-encoded bytes.
	innerData = innerData[4:]

	// --- build schema UID ---
	schemaBytes, err := hex.DecodeString(strings.TrimPrefix(schemaUID, "0x"))
	if err != nil {
		return nil, fmt.Errorf("parse schema UID: %w", err)
	}
	var schemaHash [32]byte
	copy(schemaHash[:], schemaBytes)

	// --- ABI-encode attest() calldata ---
	type attestDataStruct struct {
		Recipient      gethcommon.Address
		ExpirationTime uint64
		Revocable      bool
		RefUID         [32]byte
		Data           []byte
		Value          *big.Int
	}
	type attestRequestStruct struct {
		Schema [32]byte
		Data   attestDataStruct
	}

	calldata, err := easAttestABI.Pack("attest", attestRequestStruct{
		Schema: schemaHash,
		Data: attestDataStruct{
			Recipient:      gethcommon.Address{}, // no specific recipient
			ExpirationTime: 0,
			Revocable:      false, // schema registered as non-revocable
			RefUID:         [32]byte{},
			Data:           innerData,
			Value:          big.NewInt(0),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("pack attest calldata: %w", err)
	}

	// --- build + sign tx ---
	to := gethcommon.HexToAddress(EASContractAddress)
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce.Uint64(),
		To:       &to,
		Value:    big.NewInt(0),
		Gas:      300_000,
		GasPrice: gasPrice,
		Data:     calldata,
	})

	signer := types.NewEIP155Signer(chainID)
	signedTx, err := types.SignTx(tx, signer, privKey)
	if err != nil {
		return nil, fmt.Errorf("sign tx: %w", err)
	}

	// RLP-encode the signed transaction
	rawTxBytes, err := signedTx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("marshal tx: %w", err)
	}

	// --- submit ---
	txResult, err := client.call(ctx, "eth_sendRawTransaction", "0x"+hex.EncodeToString(rawTxBytes))
	if err != nil {
		return nil, fmt.Errorf("send raw transaction: %w", err)
	}

	var txHash string
	if err := json.Unmarshal(txResult, &txHash); err != nil {
		return nil, fmt.Errorf("decode tx hash: %w", err)
	}

	return &AttestationResult{TxHash: txHash}, nil
}

// ComputeMerkleRoot computes a simple Merkle root from a list of action hashes.
// Each hash must be a "sha256:..." string from the action log.
func ComputeMerkleRoot(actionHashes []string) [32]byte {
	if len(actionHashes) == 0 {
		return [32]byte{}
	}
	leaves := make([][32]byte, len(actionHashes))
	for i, h := range actionHashes {
		h = strings.TrimPrefix(h, "sha256:")
		b, _ := hex.DecodeString(h)
		copy(leaves[i][:], b)
	}
	return merkleRoot(leaves)
}

func merkleRoot(leaves [][32]byte) [32]byte {
	if len(leaves) == 1 {
		return leaves[0]
	}
	var next [][32]byte
	for i := 0; i < len(leaves); i += 2 {
		if i+1 >= len(leaves) {
			next = append(next, hashPair(leaves[i], leaves[i]))
		} else {
			next = append(next, hashPair(leaves[i], leaves[i+1]))
		}
	}
	return merkleRoot(next)
}

func hashPair(a, b [32]byte) [32]byte {
	combined := append(a[:], b[:]...)
	h := crypto.Keccak256(combined)
	var out [32]byte
	copy(out[:], h)
	return out
}
