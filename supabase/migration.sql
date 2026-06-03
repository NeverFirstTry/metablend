-- ── MetaBlend migration: region-based weights + new APIs ─────────────────────
-- Run this once in Supabase SQL editor or via psql.

-- 1. Add region column to api_weights (idempotent)
ALTER TABLE api_weights ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'global';

-- 2. Tag all existing global rows explicitly
UPDATE api_weights SET region = 'global' WHERE region = 'global';

-- 3. Drop old single-column primary key and replace with composite key
ALTER TABLE api_weights DROP CONSTRAINT IF EXISTS api_weights_pkey;
ALTER TABLE api_weights ADD PRIMARY KEY (id, region);

-- 4. Seed one row per existing API × region
INSERT INTO api_weights (id, region, weight, score, reports, name)
SELECT aw.id, r.region, aw.weight, 0, 0, aw.name
FROM   api_weights aw
CROSS JOIN (VALUES
  ('europe'), ('north_america'), ('south_america'),
  ('asia'), ('africa'), ('oceania')
) AS r(region)
WHERE aw.region = 'global'
ON CONFLICT (id, region) DO NOTHING;

-- 5. Add Tomorrow.io for all regions
INSERT INTO api_weights (id, region, weight, score, reports, name) VALUES
  ('tomorrow', 'global',        0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'europe',        0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'north_america', 0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'south_america', 0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'asia',          0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'africa',        0.25, 0, 0, 'Tomorrow.io'),
  ('tomorrow', 'oceania',       0.25, 0, 0, 'Tomorrow.io')
ON CONFLICT (id, region) DO NOTHING;

-- 6. Add MET Norway for all regions
INSERT INTO api_weights (id, region, weight, score, reports, name) VALUES
  ('met-norway', 'global',        0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'europe',        0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'north_america', 0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'south_america', 0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'asia',          0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'africa',        0.25, 0, 0, 'MET Norway'),
  ('met-norway', 'oceania',       0.25, 0, 0, 'MET Norway')
ON CONFLICT (id, region) DO NOTHING;

-- 7. Add region column to forecasts table
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'global';
