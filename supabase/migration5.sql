-- ── MetaBlend migration 5: consensus history ────────────────────────────────
-- Run after migration4.sql. Stores a snapshot of every consensus we compute so
-- the RSS feed and the intraday consensus chart have something to read.

CREATE TABLE IF NOT EXISTS consensus_history (
  id             BIGSERIAL PRIMARY KEY,
  city           TEXT NOT NULL,
  country        TEXT,
  region         TEXT DEFAULT 'global',
  temp           REAL,
  feels_like     REAL,
  rain_pct       INT,
  wind_kmh       INT,
  confidence_pct INT,
  condition      TEXT,
  source_count   INT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consensus_history_city_time
  ON consensus_history (city, created_at DESC);
