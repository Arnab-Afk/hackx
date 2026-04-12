package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Wallet    string    `json:"wallet"`
	PublicKey string    `json:"public_key"`
	CreatedAt time.Time `json:"created_at"`
}

type Session struct {
	ID        string    `json:"id"`
	TeamID    string    `json:"team_id"`
	Prompt    string    `json:"prompt"`
	State     string    `json:"state"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ActionLog struct {
	ID        int64     `json:"id"`
	SessionID string    `json:"session_id"`
	TeamID    string    `json:"team_id"`
	Actions   []byte    `json:"actions"` // JSON array
	CreatedAt time.Time `json:"created_at"`
}

type Attestation struct {
	ID              int64     `json:"id"`
	SessionID       string    `json:"session_id"`
	TxHash          string    `json:"tx_hash"`
	AttestationUID  string    `json:"attestation_uid"`  // resolved from tx receipt
	MerkleRoot      string    `json:"merkle_root"`
	SchemaUID       string    `json:"schema_uid"`
	EASScanURL      string    `json:"eas_scan_url"`
	CreatedAt       time.Time `json:"created_at"`
}

type ProviderRecord struct {
	Address       string    `json:"address"`
	Endpoint      string    `json:"endpoint"`
	PricePerHour  string    `json:"price_per_hour"` // wei as string
	JobsCompleted int64     `json:"jobs_completed"`
	SelectedAt    time.Time `json:"selected_at"`
	SessionID     string    `json:"session_id"`
}

// Workspace persists SSH credentials for a team workspace across restarts.
type Workspace struct {
	ContainerID string    `json:"container_id"`
	TeamID      string    `json:"team_id"`
	SSHHost     string    `json:"ssh_host"`
	SSHPort     int       `json:"ssh_port"`
	AppPort     int       `json:"app_port"`
	Username    string    `json:"username"`
	Password    string    `json:"password"`
	StoragePath string    `json:"storage_path"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// Payment records an x402 micro-payment.
type Payment struct {
	ID         int64     `json:"id"`
	Wallet     string    `json:"wallet"`
	SessionID  string    `json:"session_id"`
	AmountUSDC string    `json:"amount_usdc"`
	TxHash     string    `json:"tx_hash"`
	Nonce      string    `json:"nonce"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// Secret is an encrypted key-value secret belonging to a wallet.
type Secret struct {
	ID             int64     `json:"id"`
	Wallet         string    `json:"wallet"`
	Name           string    `json:"name"`
	EncryptedValue string    `json:"encrypted_value"` // hex(nonce||ciphertext)
	CreatedAt      time.Time `json:"created_at"`
}

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgx pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS teams (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL UNIQUE,
			public_key TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id         TEXT PRIMARY KEY,
			team_id    TEXT NOT NULL REFERENCES teams(id),
			prompt     TEXT NOT NULL,
			state      TEXT NOT NULL DEFAULT 'running',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS action_logs (
			id         BIGSERIAL PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES sessions(id),
			team_id    TEXT NOT NULL,
			actions    JSONB NOT NULL DEFAULT '[]',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS attestations (
			id               BIGSERIAL PRIMARY KEY,
			session_id       TEXT NOT NULL REFERENCES sessions(id),
			tx_hash          TEXT NOT NULL,
			attestation_uid  TEXT NOT NULL DEFAULT '',
			merkle_root      TEXT NOT NULL DEFAULT '',
			schema_uid       TEXT NOT NULL DEFAULT '',
			eas_scan_url     TEXT NOT NULL DEFAULT '',
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS provider_selections (
			id             BIGSERIAL PRIMARY KEY,
			session_id     TEXT NOT NULL REFERENCES sessions(id),
			address        TEXT NOT NULL,
			endpoint       TEXT NOT NULL,
			price_per_hour TEXT NOT NULL DEFAULT '0',
			jobs_completed BIGINT NOT NULL DEFAULT 0,
			selected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS github_tokens (
			wallet     TEXT PRIMARY KEY,
			token      TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS workspaces (
			container_id TEXT PRIMARY KEY,
			team_id      TEXT NOT NULL REFERENCES teams(id),
			ssh_host     TEXT NOT NULL DEFAULT 'localhost',
			ssh_port     INT  NOT NULL DEFAULT 0,
			app_port     INT  NOT NULL DEFAULT 0,
			username     TEXT NOT NULL DEFAULT '',
			password     TEXT NOT NULL DEFAULT '',
			storage_path TEXT NOT NULL DEFAULT '',
			status       TEXT NOT NULL DEFAULT 'provisioning',
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS payments (
			id           BIGSERIAL PRIMARY KEY,
			wallet       TEXT NOT NULL,
			session_id   TEXT NOT NULL DEFAULT '',
			amount_usdc  TEXT NOT NULL DEFAULT '0',
			tx_hash      TEXT NOT NULL DEFAULT '',
			nonce        TEXT NOT NULL DEFAULT '',
			status       TEXT NOT NULL DEFAULT 'confirmed',
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS secrets (
			id              BIGSERIAL PRIMARY KEY,
			wallet          TEXT NOT NULL,
			name            TEXT NOT NULL,
			encrypted_value TEXT NOT NULL DEFAULT '',
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (wallet, name)
		);
	`)
	if err != nil {
		return err
	}
	// Idempotent column additions for older deployments
	_, _ = s.pool.Exec(ctx, `ALTER TABLE attestations ADD COLUMN IF NOT EXISTS attestation_uid TEXT NOT NULL DEFAULT ''`)
	_, _ = s.pool.Exec(ctx, `ALTER TABLE teams ADD COLUMN IF NOT EXISTS wallet TEXT NOT NULL DEFAULT ''`)
	_, _ = s.pool.Exec(ctx, `CREATE UNIQUE INDEX IF NOT EXISTS teams_wallet_idx ON teams(wallet) WHERE wallet != ''`)
	return nil
}

// --- Teams ---

func (s *Store) CreateTeam(ctx context.Context, t *Team) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO teams (id, name, wallet, public_key, created_at) VALUES ($1, $2, $3, $4, $5)`,
		t.ID, t.Name, t.Wallet, t.PublicKey, t.CreatedAt)
	return err
}

func (s *Store) GetTeam(ctx context.Context, id string) (*Team, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, COALESCE(wallet,''), public_key, created_at FROM teams WHERE id = $1`, id)
	var t Team
	if err := row.Scan(&t.ID, &t.Name, &t.Wallet, &t.PublicKey, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) GetTeamByName(ctx context.Context, name string) (*Team, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, COALESCE(wallet,''), public_key, created_at FROM teams WHERE name = $1`, name)
	var t Team
	if err := row.Scan(&t.ID, &t.Name, &t.Wallet, &t.PublicKey, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) UpdateTeamName(ctx context.Context, id, name string) error {
	_, err := s.pool.Exec(ctx, `UPDATE teams SET name=$1 WHERE id=$2`, name, id)
	return err
}

// GetOrCreateTeamByWallet finds the team owned by this wallet address, creating one if it doesn't exist.
func (s *Store) GetOrCreateTeamByWallet(ctx context.Context, wallet string) (*Team, error) {
	wall := strings.ToLower(wallet)
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, COALESCE(wallet,''), public_key, created_at FROM teams WHERE wallet = $1`, wall)
	var t Team
	err := row.Scan(&t.ID, &t.Name, &t.Wallet, &t.PublicKey, &t.CreatedAt)
	if err == nil {
		return &t, nil
	}
	// Not found — create a new team for this wallet
	now := time.Now().UTC()
	t = Team{
		ID:        "team-" + wall[2:10], // deterministic prefix
		Name:      "account-" + wall[2:10],
		Wallet:    wall,
		PublicKey: "",
		CreatedAt: now,
	}
	// Use ON CONFLICT to handle race conditions
	_, err = s.pool.Exec(ctx,
		`INSERT INTO teams (id, name, wallet, public_key, created_at) VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (wallet) WHERE wallet != '' DO NOTHING`,
		t.ID, t.Name, t.Wallet, t.PublicKey, t.CreatedAt)
	if err != nil {
		return nil, err
	}
	// Re-fetch (in case another request won the race)
	row = s.pool.QueryRow(ctx,
		`SELECT id, name, COALESCE(wallet,''), public_key, created_at FROM teams WHERE wallet = $1`, wall)
	if err2 := row.Scan(&t.ID, &t.Name, &t.Wallet, &t.PublicKey, &t.CreatedAt); err2 != nil {
		return nil, err2
	}
	return &t, nil
}

// --- Sessions ---

func (s *Store) CreateSession(ctx context.Context, sess *Session) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sessions (id, team_id, prompt, state, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		sess.ID, sess.TeamID, sess.Prompt, sess.State, sess.CreatedAt, sess.UpdatedAt)
	return err
}

func (s *Store) UpdateSessionState(ctx context.Context, id, state string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET state=$1, updated_at=NOW() WHERE id=$2`, state, id)
	return err
}

func (s *Store) GetSession(ctx context.Context, id string) (*Session, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, team_id, prompt, state, created_at, updated_at FROM sessions WHERE id=$1`, id)
	var sess Session
	err := row.Scan(&sess.ID, &sess.TeamID, &sess.Prompt, &sess.State, &sess.CreatedAt, &sess.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// --- Action Logs ---

func (s *Store) SaveActionLog(ctx context.Context, sessionID, teamID string, actions any) error {
	b, err := json.Marshal(actions)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`INSERT INTO action_logs (session_id, team_id, actions) VALUES ($1, $2, $3)`,
		sessionID, teamID, b)
	return err
}

func (s *Store) GetActionLog(ctx context.Context, sessionID string) (*ActionLog, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, session_id, team_id, actions, created_at FROM action_logs WHERE session_id=$1 ORDER BY id DESC LIMIT 1`,
		sessionID)
	var log ActionLog
	err := row.Scan(&log.ID, &log.SessionID, &log.TeamID, &log.Actions, &log.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// --- Attestations ---

func (s *Store) SaveAttestation(ctx context.Context, a *Attestation) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO attestations (session_id, tx_hash, attestation_uid, merkle_root, schema_uid, eas_scan_url)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		a.SessionID, a.TxHash, a.AttestationUID, a.MerkleRoot, a.SchemaUID, a.EASScanURL)
	return err
}

func (s *Store) GetAttestation(ctx context.Context, sessionID string) (*Attestation, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, session_id, tx_hash, attestation_uid, merkle_root, schema_uid, eas_scan_url, created_at
		 FROM attestations WHERE session_id=$1 ORDER BY id DESC LIMIT 1`, sessionID)
	var a Attestation
	err := row.Scan(&a.ID, &a.SessionID, &a.TxHash, &a.AttestationUID, &a.MerkleRoot, &a.SchemaUID, &a.EASScanURL, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// --- Provider selections ---

func (s *Store) SaveProviderSelection(ctx context.Context, p *ProviderRecord) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO provider_selections (session_id, address, endpoint, price_per_hour, jobs_completed)
		 VALUES ($1, $2, $3, $4, $5)`,
		p.SessionID, p.Address, p.Endpoint, p.PricePerHour, p.JobsCompleted)
	return err
}

func (s *Store) GetProviderSelection(ctx context.Context, sessionID string) (*ProviderRecord, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT session_id, address, endpoint, price_per_hour, jobs_completed, selected_at
		 FROM provider_selections WHERE session_id=$1 ORDER BY id DESC LIMIT 1`, sessionID)
	var p ProviderRecord
	err := row.Scan(&p.SessionID, &p.Address, &p.Endpoint, &p.PricePerHour, &p.JobsCompleted, &p.SelectedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// --- Sessions list ---

func (s *Store) ListSessions(ctx context.Context, teamID string, limit int) ([]Session, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, team_id, prompt, state, created_at, updated_at
		 FROM sessions WHERE team_id=$1 ORDER BY created_at DESC LIMIT $2`, teamID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Session
	for rows.Next() {
		var sess Session
		if err := rows.Scan(&sess.ID, &sess.TeamID, &sess.Prompt, &sess.State, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, sess)
	}
	return list, nil
}

// --- Attestations list ---

func (s *Store) ListAttestations(ctx context.Context, teamID string, limit int) ([]Attestation, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT a.id, a.session_id, a.tx_hash, a.attestation_uid, a.merkle_root, a.schema_uid, a.eas_scan_url, a.created_at
		 FROM attestations a JOIN sessions s ON s.id = a.session_id
		 WHERE s.team_id=$1 ORDER BY a.created_at DESC LIMIT $2`, teamID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Attestation
	for rows.Next() {
		var a Attestation
		if err := rows.Scan(&a.ID, &a.SessionID, &a.TxHash, &a.AttestationUID, &a.MerkleRoot, &a.SchemaUID, &a.EASScanURL, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

// --- GitHub tokens ---

func (s *Store) SaveGitHubToken(ctx context.Context, wallet, token string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO github_tokens (wallet, token, updated_at) VALUES ($1, $2, NOW())
		 ON CONFLICT (wallet) DO UPDATE SET token=EXCLUDED.token, updated_at=NOW()`,
		wallet, token)
	return err
}

func (s *Store) GetGitHubToken(ctx context.Context, wallet string) (string, error) {
	var token string
	err := s.pool.QueryRow(ctx, `SELECT token FROM github_tokens WHERE wallet=$1`, wallet).Scan(&token)
	return token, err
}

// --- Workspaces ---

func (s *Store) SaveWorkspace(ctx context.Context, ws *Workspace) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO workspaces (container_id, team_id, ssh_host, ssh_port, app_port, username, password, storage_path, status, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 ON CONFLICT (container_id) DO UPDATE SET
		   ssh_host=EXCLUDED.ssh_host, ssh_port=EXCLUDED.ssh_port, app_port=EXCLUDED.app_port,
		   username=EXCLUDED.username, password=EXCLUDED.password, storage_path=EXCLUDED.storage_path,
		   status=EXCLUDED.status`,
		ws.ContainerID, ws.TeamID, ws.SSHHost, ws.SSHPort, ws.AppPort,
		ws.Username, ws.Password, ws.StoragePath, ws.Status, ws.CreatedAt)
	return err
}

func (s *Store) UpdateWorkspaceStatus(ctx context.Context, containerID, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE workspaces SET status=$1 WHERE container_id=$2`, status, containerID)
	return err
}

func (s *Store) GetWorkspace(ctx context.Context, containerID string) (*Workspace, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT container_id, team_id, ssh_host, ssh_port, app_port, username, password, storage_path, status, created_at
		 FROM workspaces WHERE container_id=$1`, containerID)
	var ws Workspace
	err := row.Scan(&ws.ContainerID, &ws.TeamID, &ws.SSHHost, &ws.SSHPort, &ws.AppPort,
		&ws.Username, &ws.Password, &ws.StoragePath, &ws.Status, &ws.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

func (s *Store) ListWorkspaces(ctx context.Context, teamID string) ([]Workspace, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT container_id, team_id, ssh_host, ssh_port, app_port, username, password, storage_path, status, created_at
		 FROM workspaces WHERE team_id=$1 ORDER BY created_at DESC`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Workspace
	for rows.Next() {
		var ws Workspace
		if err := rows.Scan(&ws.ContainerID, &ws.TeamID, &ws.SSHHost, &ws.SSHPort, &ws.AppPort,
			&ws.Username, &ws.Password, &ws.StoragePath, &ws.Status, &ws.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, ws)
	}
	return list, nil
}

// --- Payments ---

func (s *Store) SavePayment(ctx context.Context, p *Payment) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO payments (wallet, session_id, amount_usdc, tx_hash, nonce, status)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		p.Wallet, p.SessionID, p.AmountUSDC, p.TxHash, p.Nonce, p.Status)
	return err
}

func (s *Store) ListPayments(ctx context.Context, wallet string, limit int) ([]Payment, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, wallet, session_id, amount_usdc, tx_hash, nonce, status, created_at
		 FROM payments WHERE wallet=$1 ORDER BY created_at DESC LIMIT $2`, wallet, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := rows.Scan(&p.ID, &p.Wallet, &p.SessionID, &p.AmountUSDC, &p.TxHash, &p.Nonce, &p.Status, &p.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

// --- Secrets ---

func (s *Store) SaveSecret(ctx context.Context, wallet, name, encryptedValue string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO secrets (wallet, name, encrypted_value)
		 VALUES ($1,$2,$3)
		 ON CONFLICT (wallet, name) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value`,
		wallet, name, encryptedValue)
	return err
}

func (s *Store) ListSecrets(ctx context.Context, wallet string) ([]Secret, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, wallet, name, encrypted_value, created_at FROM secrets WHERE wallet=$1 ORDER BY created_at DESC`,
		wallet)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Secret
	for rows.Next() {
		var sec Secret
		if err := rows.Scan(&sec.ID, &sec.Wallet, &sec.Name, &sec.EncryptedValue, &sec.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, sec)
	}
	return list, nil
}

func (s *Store) DeleteSecret(ctx context.Context, id int64, wallet string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM secrets WHERE id=$1 AND wallet=$2`, id, wallet)
	return err
}
