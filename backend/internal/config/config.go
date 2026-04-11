package config

import (
	"os"
)

type Config struct {
	Port            string
	DatabaseURL     string
	AnthropicAPIKey string
	DockerHost      string
	ProxyURL        string // antigravity-claude-proxy for Gemini
	GeminiModel     string // model to use for repo scanning
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://zkloud:zkloud@localhost:5432/zkloud?sslmode=disable"),
		AnthropicAPIKey: mustEnv("ANTHROPIC_API_KEY"),
		DockerHost:      getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		ProxyURL:        getEnv("PROXY_URL", "http://localhost:8080"),
		GeminiModel:     getEnv("GEMINI_MODEL", "gemini-3.1-pro-high"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var not set: " + key)
	}
	return v
}
