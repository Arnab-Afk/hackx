package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	DockerHost  string
	ProxyURL    string // antigravity-claude-proxy base URL
	ScanModel   string // model for repo scanning (via proxy)
	AgentModel  string // model for deployment agent (via proxy)

	// Blockchain
	BaseSepolia_RPC_URL      string
	ProviderRegistryAddress  string
	EASSchemaUID             string
	AgentWalletPrivateKey    string

	// Vault — used to derive per-user LUKS keys
	// Each user key = keccak256(VaultMasterSecret + attestation_uid)
	VaultMasterSecret string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://hackx:hackx@localhost:5433/hackx?sslmode=disable"),
		DockerHost:  getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		ProxyURL:    getEnv("PROXY_URL", "http://localhost:8082"),
		ScanModel:   getEnv("SCAN_MODEL", "gemini-3-flash"),
		AgentModel:  getEnv("AGENT_MODEL", "gemini-3-flash"),

		BaseSepolia_RPC_URL:     getEnv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org"),
		ProviderRegistryAddress: getEnv("PROVIDER_REGISTRY_ADDRESS", "0x889a1EB1489626F39C84b880a67e5eeAE3dD6884"),
		EASSchemaUID:            getEnv("EAS_SCHEMA_UID", "0x001219cb6b1ad28ce53a643f532872015acab85429133286b9e2c96e910945f0"),
		AgentWalletPrivateKey:   getEnv("AGENT_WALLET_PRIVATE_KEY", ""),
		VaultMasterSecret:       getEnv("VAULT_MASTER_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

