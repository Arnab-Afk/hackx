package chain

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	gethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// Provider mirrors the on-chain ProviderRegistry.Provider struct.
type Provider struct {
	Wallet        gethcommon.Address
	Endpoint      string
	PricePerHour  *big.Int
	StakedAmount  *big.Int
	SlashCount    *big.Int
	JobsCompleted *big.Int
	Active        bool
}

// providerABI is the ABI for the getActiveProviders() function.
// The Provider struct tuple matches the Solidity definition exactly.
var providerABI abi.ABI

func init() {
	const abiJSON = `[{
		"name": "getActiveProviders",
		"type": "function",
		"stateMutability": "view",
		"inputs": [],
		"outputs": [{
			"name": "",
			"type": "tuple[]",
			"components": [
				{"name": "wallet",        "type": "address"},
				{"name": "endpoint",      "type": "string"},
				{"name": "pricePerHour",  "type": "uint256"},
				{"name": "stakedAmount",  "type": "uint256"},
				{"name": "slashCount",    "type": "uint256"},
				{"name": "jobsCompleted", "type": "uint256"},
				{"name": "active",        "type": "bool"}
			]
		}]
	}]`

	var err error
	providerABI, err = abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		panic(fmt.Sprintf("chain: invalid provider ABI: %v", err))
	}
}

// SelectProvider queries the ProviderRegistry contract on-chain, filters active
// providers with enough stake, and returns the cheapest one (tiebreak: most jobs).
func SelectProvider(ctx context.Context, rpcURL, registryAddress string) (*Provider, error) {
	client := newRPCClient(rpcURL)

	// Build calldata: 4-byte selector for getActiveProviders()
	selector := crypto.Keccak256([]byte("getActiveProviders()"))[:4]
	calldata := "0x" + hex.EncodeToString(selector)

	result, err := client.call(ctx, "eth_call", map[string]string{
		"to":   registryAddress,
		"data": calldata,
	}, "latest")
	if err != nil {
		return nil, fmt.Errorf("eth_call getActiveProviders: %w", err)
	}

	// result is a JSON string like "\"0x...\""
	var hexStr string
	if err := json.Unmarshal(result, &hexStr); err != nil {
		return nil, fmt.Errorf("decode eth_call result: %w", err)
	}
	hexStr = strings.TrimPrefix(hexStr, "0x")

	rawBytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("decode hex: %w", err)
	}

	// ABI-decode the returned Provider[]
	out, err := providerABI.Methods["getActiveProviders"].Outputs.Unpack(rawBytes)
	if err != nil {
		return nil, fmt.Errorf("abi unpack providers: %w", err)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no providers returned")
	}

	// The decoded output is a slice of anonymous structs — marshal+unmarshal to our type.
	raw, err := json.Marshal(out[0])
	if err != nil {
		return nil, err
	}

	type onChainProvider struct {
		Wallet        gethcommon.Address `json:"wallet"`
		Endpoint      string             `json:"endpoint"`
		PricePerHour  *big.Int           `json:"pricePerHour"`
		StakedAmount  *big.Int           `json:"stakedAmount"`
		SlashCount    *big.Int           `json:"slashCount"`
		JobsCompleted *big.Int           `json:"jobsCompleted"`
		Active        bool               `json:"active"`
	}

	var providers []onChainProvider
	if err := json.Unmarshal(raw, &providers); err != nil {
		return nil, fmt.Errorf("unmarshal providers: %w", err)
	}

	if len(providers) == 0 {
		return nil, fmt.Errorf("no active providers with sufficient stake on-chain")
	}

	// Sort: cheapest first, then most jobs completed as tiebreaker
	sort.Slice(providers, func(i, j int) bool {
		cmp := providers[i].PricePerHour.Cmp(providers[j].PricePerHour)
		if cmp != 0 {
			return cmp < 0
		}
		return providers[i].JobsCompleted.Cmp(providers[j].JobsCompleted) > 0
	})

	p := providers[0]
	return &Provider{
		Wallet:        p.Wallet,
		Endpoint:      p.Endpoint,
		PricePerHour:  p.PricePerHour,
		StakedAmount:  p.StakedAmount,
		SlashCount:    p.SlashCount,
		JobsCompleted: p.JobsCompleted,
		Active:        p.Active,
	}, nil
}
