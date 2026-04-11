package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
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
		ALTER TABLE attestations ADD COLUMN IF NOT EXISTS attestation_uid TEXT NOT NULL DEFAULT '';

		CREATE TABLE IF NOT EXISTS provider_selections (
			id             BIGSERIAL PRIMARY KEY,
			session_id     TEXT NOT NULL REFERENCES sessions(id),
			address        TEXT NOT NULL,
			endpoint       TEXT NOT NULL,
			price_per_hour TEXT NOT NULL DEFAULT '0',
			jobs_completed BIGINT NOT NULL DEFAULT 0,
			selected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
	return err
}

// --- Teams ---

func (s *Store) CreateTeam(ctx context.Context, t *Team) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO teams (id, name, public_key, created_at) VALUES ($1, $2, $3, $4)`,
		t.ID, t.Name, t.PublicKey, t.CreatedAt)
	return err
}

func (s *Store) GetTeam(ctx context.Context, id string) (*Team, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, public_key, created_at FROM teams WHERE id = $1`, id)
	var t Team
	if err := row.Scan(&t.ID, &t.Name, &t.PublicKey, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) GetTeamByName(ctx context.Context, name string) (*Team, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, public_key, created_at FROM teams WHERE name = $1`, name)
	var t Team
	if err := row.Scan(&t.ID, &t.Name, &t.PublicKey, &t.CreatedAt); err != nil {
		return nil, err
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
