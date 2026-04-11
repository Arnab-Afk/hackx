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
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://hackx:hackx@localhost:5433/hackx?sslmode=disable"),
		DockerHost:  getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		ProxyURL:    getEnv("PROXY_URL", "http://localhost:8080"),
		ScanModel:   getEnv("SCAN_MODEL", "gemini-3-flash"),
		AgentModel:  getEnv("AGENT_MODEL", "gemini-3-flash"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

