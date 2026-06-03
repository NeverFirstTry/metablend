-- ── MetaBlend migration 6: API stats (response time + uptime) ───────────────
-- Run after migration5.sql. consensus_history was created in migration5.

CREATE TABLE IF NOT EXISTS api_stats (
  api_id          TEXT PRIMARY KEY,
  avg_response_ms REAL,
  success_count   BIGINT DEFAULT 0,
  fail_count      BIGINT DEFAULT 0,
  last_checked    TIMESTAMPTZ DEFAULT now()
);
