package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/Arnab-Afk/hackx/backend/internal/api"
	"github.com/Arnab-Afk/hackx/backend/internal/config"
	"github.com/Arnab-Afk/hackx/backend/internal/container"
	"github.com/Arnab-Afk/hackx/backend/internal/scanner"
	"github.com/Arnab-Afk/hackx/backend/internal/store"
)

func main() {
	// Load .env if present (ignored in production)
	_ = godotenv.Load()

	cfg := config.Load()

	ctx := context.Background()

	// --- Database ---
	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	if err := db.Migrate(ctx); err != nil {
		log.Fatalf("migrate db: %v", err)
	}
	log.Println("database ready")

	// --- Container Manager ---
	mgr, err := container.NewManager(cfg.DockerHost)
	if err != nil {
		log.Fatalf("container manager: %v", err)
	}
	log.Println("docker manager ready")

	// --- Scanner (via proxy — used once per deploy) ---
	sc := scanner.New(cfg.ProxyURL, cfg.ScanModel)
	log.Println("scanner ready")

	// --- HTTP Server ---
	handler := api.NewServer(mgr, sc, db, cfg.ProxyURL, "", cfg.AgentModel,
		cfg.BaseSepolia_RPC_URL, cfg.ProviderRegistryAddress,
		cfg.EASSchemaUID, cfg.AgentWalletPrivateKey,
		cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.GitHubCallbackURL, cfg.GitHubFrontendURL,
		cfg.JWTSecret, cfg.VaultMasterSecret,
	)
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // WebSocket connections need unlimited write timeout
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	log.Println("done")
}
