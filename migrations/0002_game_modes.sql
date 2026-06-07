ALTER TABLE games
ADD COLUMN mode TEXT NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'cpu', 'friend'));

CREATE INDEX games_mode_status_updated_at_idx ON games(mode, status, updated_at);
