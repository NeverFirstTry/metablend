-- ── MetaBlend migration 4: geolocated feedback for heatmap ──────────────────
-- Run after migration3.sql in the Supabase SQL editor.

-- Coordinates + consensus accuracy per feedback row, used by /heatmap.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS lat       DOUBLE PRECISION;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS lon       DOUBLE PRECISION;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS accuracy  REAL;

-- Optional: speed up the heatmap query
CREATE INDEX IF NOT EXISTS feedback_latlon_idx ON feedback (lat, lon);
