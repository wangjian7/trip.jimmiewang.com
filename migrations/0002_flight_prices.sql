CREATE TABLE IF NOT EXISTS flight_watches (
  id TEXT PRIMARY KEY NOT NULL,
  trip_slug TEXT,
  label TEXT NOT NULL,

  origin_code TEXT NOT NULL,
  dest_code TEXT NOT NULL,
  travel_date TEXT NOT NULL,

  direct_only INTEGER NOT NULL DEFAULT 1,
  cabin TEXT NOT NULL DEFAULT 'economy',
  adult_count INTEGER NOT NULL DEFAULT 1,

  source TEXT NOT NULL DEFAULT 'ceair',
  source_url TEXT,
  pinned_flight_numbers TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(origin_code, dest_code, travel_date, cabin, direct_only, source)
);

CREATE INDEX IF NOT EXISTS idx_flight_watches_trip
  ON flight_watches(trip_slug);

CREATE TABLE IF NOT EXISTS flight_scrape_runs (
  id TEXT PRIMARY KEY NOT NULL,
  watch_id TEXT NOT NULL,

  scrape_date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('am', 'pm')),

  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('running', 'success', 'failed')),
  error_message TEXT,
  requested_url TEXT,

  flights_found INTEGER NOT NULL DEFAULT 0,
  min_price_cny INTEGER,

  FOREIGN KEY (watch_id) REFERENCES flight_watches(id),
  UNIQUE(watch_id, scrape_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_flight_scrape_runs_watch
  ON flight_scrape_runs(watch_id, scrape_date);

CREATE TABLE IF NOT EXISTS flight_quotes (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  watch_id TEXT NOT NULL,

  flight_fingerprint TEXT NOT NULL,
  flight_numbers TEXT NOT NULL,
  airline_name TEXT,
  is_direct INTEGER NOT NULL DEFAULT 1,

  travel_date TEXT NOT NULL,
  depart_at TEXT NOT NULL,
  arrive_at TEXT NOT NULL,
  duration_minutes INTEGER,
  aircraft TEXT,

  price_economy_cny INTEGER,
  price_premium_cny INTEGER,
  price_business_cny INTEGER,

  scraped_at TEXT NOT NULL,

  FOREIGN KEY (run_id) REFERENCES flight_scrape_runs(id),
  FOREIGN KEY (watch_id) REFERENCES flight_watches(id),
  UNIQUE(run_id, flight_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_flight_quotes_trend
  ON flight_quotes(flight_fingerprint, scraped_at);
CREATE INDEX IF NOT EXISTS idx_flight_quotes_watch
  ON flight_quotes(watch_id, travel_date, scraped_at);
