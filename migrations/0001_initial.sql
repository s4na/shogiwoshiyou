CREATE TABLE users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retired_at TEXT
);

CREATE TABLE user_private_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  black_user_id TEXT NOT NULL REFERENCES users(id),
  white_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'ended')),
  sfen TEXT NOT NULL,
  moves_json TEXT NOT NULL DEFAULT '[]',
  current_turn TEXT NOT NULL CHECK (current_turn IN ('black', 'white')),
  winner_user_id TEXT REFERENCES users(id),
  end_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX games_status_updated_at_idx ON games(status, updated_at);
CREATE INDEX games_black_user_id_idx ON games(black_user_id);
CREATE INDEX games_white_user_id_idx ON games(white_user_id);

CREATE TABLE game_events (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  payload_json TEXT NOT NULL,
  client_request_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(game_id, seq),
  UNIQUE(game_id, client_request_id)
);

CREATE INDEX game_events_game_id_seq_idx ON game_events(game_id, seq);
