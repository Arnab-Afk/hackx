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

// USDC contract on Base Sepolia (Circle's official deployment).
const USDCAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

// USDC has 6 decimals. 1 USDC = 1_000_000.
const USDCDecimals = 6

// TransferAuth holds the EIP-3009 transferWithAuthorization parameters from the client.
type TransferAuth struct {
	From        gethcommon.Address
	To          gethcommon.Address
	Value       *big.Int
	ValidAfter  *big.Int
	ValidBefore *big.Int
	Nonce       [32]byte
	V           uint8
	R           [32]byte
	S           [32]byte
}

// EIP-712 domain separator and type hashes — computed once at startup.
var (
	usdcDomainSeparator [32]byte
	transferTypeHash    [32]byte
	usdcABI             abi.ABI
)

func init() {
	// TransferWithAuthorization type string
	transferTypeString := "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
	transferTypeHash = [32]byte(crypto.Keccak256Hash([]byte(transferTypeString)))

	// EIP-712 domain type string
	domainTypeString := "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
	domainTypeHash := crypto.Keccak256Hash([]byte(domainTypeString))

	nameHash := crypto.Keccak256Hash([]byte("USD Coin"))
	versionHash := crypto.Keccak256Hash([]byte("2"))
	chainID := big.NewInt(84532) // Base Sepolia
	verifyingContract := gethcommon.HexToAddress(USDCAddress)

	// abi.encode(domainTypeHash, nameHash, versionHash, chainId, verifyingContract)
	domainEncABI, _ := abi.JSON(strings.NewReader(`[{"name":"f","type":"function","inputs":[
		{"name":"domainTypeHash","type":"bytes32"},
		{"name":"nameHash","type":"bytes32"},
		{"name":"versionHash","type":"bytes32"},
		{"name":"chainId","type":"uint256"},
		{"name":"verifyingContract","type":"address"}
	],"outputs":[]}]`))

	packed, err := domainEncABI.Pack("f",
		[32]byte(domainTypeHash),
		[32]byte(nameHash),
		[32]byte(versionHash),
		chainID,
		verifyingContract,
	)
	if err != nil {
		panic(fmt.Sprintf("chain: compute USDC domain separator: %v", err))
	}
	usdcDomainSeparator = [32]byte(crypto.Keccak256Hash(packed[4:])) // strip 4-byte selector

	// ABI for transferWithAuthorization
	const transferABIJSON = `[{
		"name": "transferWithAuthorization",
		"type": "function",
		"stateMutability": "nonpayable",
		"inputs": [
			{"name": "from",        "type": "address"},
			{"name": "to",          "type": "address"},
			{"name": "value",       "type": "uint256"},
			{"name": "validAfter",  "type": "uint256"},
			{"name": "validBefore", "type": "uint256"},
			{"name": "nonce",       "type": "bytes32"},
			{"name": "v",           "type": "uint8"},
			{"name": "r",           "type": "bytes32"},
			{"name": "s",           "type": "bytes32"}
		],
		"outputs": []
	}]`
	usdcABI, err = abi.JSON(strings.NewReader(transferABIJSON))
	if err != nil {
		panic(fmt.Sprintf("chain: parse USDC ABI: %v", err))
	}
}

// VerifyTransferAuth verifies the EIP-712 signature on a TransferWithAuthorization.
// Returns nil if valid, error otherwise.
func VerifyTransferAuth(auth TransferAuth) error {
	// structHash = keccak256(abi.encode(typeHash, from, to, value, validAfter, validBefore, nonce))
	structEncABI, _ := abi.JSON(strings.NewReader(`[{"name":"f","type":"function","inputs":[
		{"name":"typeHash",     "type":"bytes32"},
		{"name":"from",         "type":"address"},
		{"name":"to",           "type":"address"},
		{"name":"value",        "type":"uint256"},
		{"name":"validAfter",   "type":"uint256"},
		{"name":"validBefore",  "type":"uint256"},
		{"name":"nonce",        "type":"bytes32"}
	],"outputs":[]}]`))

	packed, err := structEncABI.Pack("f",
		transferTypeHash,
		auth.From,
		auth.To,
		auth.Value,
		auth.ValidAfter,
		auth.ValidBefore,
		auth.Nonce,
	)
	if err != nil {
		return fmt.Errorf("pack struct hash: %w", err)
	}
	structHash := crypto.Keccak256(packed[4:])

	// digest = keccak256("\x19\x01" + domainSeparator + structHash)
	digest := crypto.Keccak256(
		append([]byte("\x19\x01"), append(usdcDomainSeparator[:], structHash...)...),
	)

	// Recover signer
	sig := make([]byte, 65)
	copy(sig[:32], auth.R[:])
	copy(sig[32:64], auth.S[:])
	sig[64] = auth.V
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	pubKey, err := crypto.SigToPub(digest, sig)
	if err != nil {
		return fmt.Errorf("recover signer: %w", err)
	}
	recovered := crypto.PubkeyToAddress(*pubKey)
	if recovered != auth.From {
		return fmt.Errorf("signature mismatch: recovered %s, expected %s", recovered.Hex(), auth.From.Hex())
	}
	return nil
}

// SubmitTransferWithAuthorization sends the USDC transferWithAuthorization tx on behalf of the agent.
// The agent wallet pays gas; the USDC moves from `auth.From` to `auth.To`.
func SubmitTransferWithAuthorization(ctx context.Context, rpcURL, agentPrivKeyHex string, auth TransferAuth) (string, error) {
	client := newRPCClient(rpcURL)

	privKeyHex := strings.TrimPrefix(agentPrivKeyHex, "0x")
	privKey, err := crypto.HexToECDSA(privKeyHex)
	if err != nil {
		return "", fmt.Errorf("parse private key: %w", err)
	}
	fromAddr := crypto.PubkeyToAddress(privKey.PublicKey)

	// Nonce
	nonceResult, err := client.call(ctx, "eth_getTransactionCount", fromAddr.Hex(), "latest")
	if err != nil {
		return "", fmt.Errorf("get nonce: %w", err)
	}
	var nonceHex string
	if err := json.Unmarshal(nonceResult, &nonceHex); err != nil {
		return "", fmt.Errorf("decode nonce: %w", err)
	}
	nonce, _ := new(big.Int).SetString(strings.TrimPrefix(nonceHex, "0x"), 16)

	// Gas price
	gasPriceResult, err := client.call(ctx, "eth_gasPrice")
	if err != nil {
		return "", fmt.Errorf("get gas price: %w", err)
	}
	var gasPriceHex string
	if err := json.Unmarshal(gasPriceResult, &gasPriceHex); err != nil {
		return "", fmt.Errorf("decode gas price: %w", err)
	}
	gasPrice, _ := new(big.Int).SetString(strings.TrimPrefix(gasPriceHex, "0x"), 16)

	// Build calldata
	calldata, err := usdcABI.Pack("transferWithAuthorization",
		auth.From,
		auth.To,
		auth.Value,
		auth.ValidAfter,
		auth.ValidBefore,
		auth.Nonce,
		auth.V,
		auth.R,
		auth.S,
	)
	if err != nil {
		return "", fmt.Errorf("pack calldata: %w", err)
	}

	to := gethcommon.HexToAddress(USDCAddress)
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce.Uint64(),
		To:       &to,
		Value:    big.NewInt(0),
		Gas:      120_000,
		GasPrice: gasPrice,
		Data:     calldata,
	})

	signer := types.NewEIP155Signer(big.NewInt(84532))
	signedTx, err := types.SignTx(tx, signer, privKey)
	if err != nil {
		return "", fmt.Errorf("sign tx: %w", err)
	}

	rawTxBytes, err := signedTx.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("marshal tx: %w", err)
	}

	txResult, err := client.call(ctx, "eth_sendRawTransaction", "0x"+hex.EncodeToString(rawTxBytes))
	if err != nil {
		return "", fmt.Errorf("send tx: %w", err)
	}

	var txHash string
	if err := json.Unmarshal(txResult, &txHash); err != nil {
		return "", fmt.Errorf("decode tx hash: %w", err)
	}
	return txHash, nil
}
