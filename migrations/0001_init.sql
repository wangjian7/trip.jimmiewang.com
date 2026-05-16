CREATE TABLE IF NOT EXISTS trips (
  slug TEXT PRIMARY KEY NOT NULL,
  write_key_hash TEXT,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_updated_at ON trips(updated_at);

