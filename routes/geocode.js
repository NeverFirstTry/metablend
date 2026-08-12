// Express router exposing /api/geocode/search and /api/geocode/reverse
const express = require('express');
const router = express.Router();
const geocoder = require('../services/geocoder');
const cache = require('../services/cache');

/*
  GET /api/geocode/search?q=...&limit=5&countrycodes=us&ttl=300
  GET /api/geocode/reverse?lat=...&lon=...&zoom=18&ttl=300
*/

// Rate limiter setup: try to use express-rate-limit if available, otherwise noop with a warning
let rateLimitMiddleware = (req, res, next) => next();
try {
  // eslint-disable-next-line global-require
  const rateLimit = require('express-rate-limit');
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // default 1 minute
  const max = Number(process.env.RATE_LIMIT_MAX) || 30; // default 30 requests per window per IP

  rateLimitMiddleware = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many geocoding requests from this IP, please try again later',
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('express-rate-limit not installed; rate limiting disabled for /api/geocode');
}

// Helper to build cache keys deterministically
function cacheKeyForSearch(q, opts) {
  // include normalized query and options
  const parts = ['search', (q || '').trim().toLowerCase()];
  if (opts) {
    if (opts.limit) parts.push(`limit:${opts.limit}`);
    if (opts.viewbox) parts.push(`viewbox:${opts.viewbox}`);
    if (opts.countrycodes) parts.push(`cc:${opts.countrycodes}`);
    if (opts.polygon_geojson) parts.push(`poly:${opts.polygon_geojson}`);
  }
  return parts.join('|');
}

function cacheKeyForReverse(lat, lon, opts) {
  const parts = ['reverse', String(lat), String(lon)];
  if (opts && opts.zoom) parts.push(`zoom:${opts.zoom}`);
  return parts.join('|');
}

// TTL in seconds for cached geocoder responses. Default can be overridden per-request via ttl query param
const DEFAULT_TTL = Number(process.env.GEOCODER_CACHE_TTL_SEC) || 300; // 5 minutes

router.get('/search', rateLimitMiddleware, async (req, res) => {
  try {
    const { q, limit, viewbox, countrycodes, polygon_geojson, ttl } = req.query;
    if (!q) return res.status(400).json({ error: 'missing query parameter q' });

    const opts = {
      limit: limit ? Number(limit) : undefined,
      viewbox,
      countrycodes,
      polygon_geojson: polygon_geojson ? Number(polygon_geojson) : undefined,
    };

    const key = cacheKeyForSearch(q, opts);
    const ttlSec = ttl ? Number(ttl) : DEFAULT_TTL;

    // Try cache first
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const result = await geocoder.search(q, opts);

    // store in cache (fire-and-forget for Redis or await for memory)
    try {
      const maybe = cache.set(key, result, ttlSec);
      if (maybe && typeof maybe.then === 'function') {
        // promise returned by redis set: don't await to keep latency small, but catch
        maybe.catch(err => {
          // eslint-disable-next-line no-console
          console.warn('cache set failed', err && err.message);
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cache set synchronous error', err && err.message);
    }

    res.json(result);
  } catch (err) {
    console.error('geocode/search error', err);
    res.status(500).json({ error: err.message || 'geocode search failed' });
  }
});

router.get('/reverse', rateLimitMiddleware, async (req, res) => {
  try {
    const { lat, lon, zoom, ttl } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'missing lat or lon' });

    const key = cacheKeyForReverse(lat, lon, { zoom: zoom ? Number(zoom) : undefined });
    const ttlSec = ttl ? Number(ttl) : DEFAULT_TTL;

    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const result = await geocoder.reverse(Number(lat), Number(lon), { zoom: zoom ? Number(zoom) : 18 });

    try {
      const maybe = cache.set(key, result, ttlSec);
      if (maybe && typeof maybe.then === 'function') {
        maybe.catch(err => {
          // eslint-disable-next-line no-console
          console.warn('cache set failed', err && err.message);
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cache set synchronous error', err && err.message);
    }

    res.json(result);
  } catch (err) {
    console.error('geocode/reverse error', err);
    res.status(500).json({ error: err.message || 'geocode reverse failed' });
  }
});

module.exports = router;
