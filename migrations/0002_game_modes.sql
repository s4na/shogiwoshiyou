ALTER TABLE games
ADD COLUMN mode TEXT NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'cpu', 'friend'));

CREATE INDEX games_mode_status_updated_at_idx ON games(mode, status, updated_at);

CREATE TABLE friend_rooms (
  passcode_hash TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX friend_rooms_game_id_idx ON friend_rooms(game_id);
