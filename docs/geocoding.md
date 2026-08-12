# Geocoding service (Nominatim) — added by g-radio

This project includes a server-side geocoding adapter at services/geocoder.js and an Express route at /api/geocode.

Usage
- Forward geocoding: GET /api/geocode/search?q=1600+Pennsylvania+Ave+NW&limit=5
- Reverse geocoding: GET /api/geocode/reverse?lat=38.897675&lon=-77.036547

Environment
- GEOCODER_URL (default https://nominatim.openstreetmap.org)
- GEOCODER_EMAIL (default g-radio@example.com) — set a real contact email for production
- Optionally GEOCODER_ACCEPT_LANGUAGE, GEOCODER_API_KEY for hosted providers.
- REDIS_URL (optional) — if set, the service will use Redis for caching. If unset, an in-memory cache is used.
- GEOCODER_CACHE_TTL_SEC — default TTL for cache in seconds (default 300)
- RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX — basic rate limiter configuration (defaults: 60000ms window, 30 reqs)

Important
- The public Nominatim endpoint is for light use only. For production traffic, self-host Nominatim or use a commercial OSM-based provider.
- Respect rate limits, set a User-Agent/email, and show OSM attribution: "© OpenStreetMap contributors".

Caching & rate-limiting
- This branch adds a caching layer (services/cache.js). By default it will use Redis when REDIS_URL is provided, and fall back to a process-local in-memory cache.
- Rate limiting is added on /api/geocode via express-rate-limit when that package is installed; if not installed, the route will still work but without enforced rate limits and a warning will be logged.

Author
- Implementation prepared for NeverFirstTry/metablend by g-radio.
