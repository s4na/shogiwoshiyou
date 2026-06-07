ALTER TABLE games
ADD COLUMN mode TEXT NOT NULL DEFAULT 'cpu' CHECK (mode IN ('cpu', 'friend'));

CREATE INDEX games_mode_status_updated_at_idx ON games(mode, status, updated_at);
