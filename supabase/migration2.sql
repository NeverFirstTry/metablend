-- ── MetaBlend migration 2: Visual Crossing + delta_history ──────────────────
-- Run after migration.sql in the Supabase SQL editor.

-- 1. Add delta_history column for median-based weight scoring
ALTER TABLE api_weights ADD COLUMN IF NOT EXISTS delta_history JSONB DEFAULT '[]'::jsonb;

-- 2. Seed Visual Crossing for all regions
INSERT INTO api_weights (id, region, weight, score, reports, name, delta_history) VALUES
  ('visual-crossing', 'global',        0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'europe',        0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'north_america', 0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'south_america', 0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'asia',          0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'africa',        0.25, 0, 0, 'Visual Crossing', '[]'),
  ('visual-crossing', 'oceania',       0.25, 0, 0, 'Visual Crossing', '[]')
ON CONFLICT (id, region) DO NOTHING;
