CREATE TABLE user_terms_agreements (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  terms_hash TEXT NOT NULL,
  agreed_at TEXT NOT NULL
);

CREATE INDEX user_terms_agreements_user_id_agreed_at_idx
ON user_terms_agreements(user_id, agreed_at);

CREATE INDEX user_terms_agreements_user_id_terms_hash_idx
ON user_terms_agreements(user_id, terms_hash);
