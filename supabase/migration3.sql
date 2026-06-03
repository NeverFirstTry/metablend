-- ── MetaBlend migration 3: World Weather Online, Weatherstack, NASA POWER ────
-- Run after migration2.sql in the Supabase SQL editor.

INSERT INTO api_weights (id, region, weight, score, reports, name, delta_history) VALUES
  ('world-weather-online', 'global',        0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'europe',        0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'north_america', 0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'south_america', 0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'asia',          0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'africa',        0.25, 0, 0, 'World Weather Online', '[]'),
  ('world-weather-online', 'oceania',       0.25, 0, 0, 'World Weather Online', '[]'),

  ('weatherstack', 'global',        0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'europe',        0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'north_america', 0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'south_america', 0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'asia',          0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'africa',        0.25, 0, 0, 'Weatherstack', '[]'),
  ('weatherstack', 'oceania',       0.25, 0, 0, 'Weatherstack', '[]'),

  ('nasa-power', 'global',        0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'europe',        0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'north_america', 0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'south_america', 0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'asia',          0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'africa',        0.25, 0, 0, 'NASA POWER', '[]'),
  ('nasa-power', 'oceania',       0.25, 0, 0, 'NASA POWER', '[]')
ON CONFLICT (id, region) DO NOTHING;
