# Geocoding service (Nominatim) — added by g-radio

This project includes a server-side geocoding adapter at services/geocoder.js and an Express route at /api/geocode.

Usage
- Forward geocoding: GET /api/geocode/search?q=1600+Pennsylvania+Ave+NW&limit=5
- Reverse geocoding: GET /api/geocode/reverse?lat=38.897675&lon=-77.036547

Environment
- GEOCODER_URL (default https://nominatim.openstreetmap.org)
- GEOCODER_EMAIL (default g-radio@example.com) — set a real contact email for production
- Optionally GEOCODER_ACCEPT_LANGUAGE, GEOCODER_API_KEY for hosted providers.

Important
- The public Nominatim endpoint is for light use only. For production traffic, self-host Nominatim or use a commercial OSM-based provider.
- Respect rate limits, set a User-Agent/email, and show OSM attribution: "© OpenStreetMap contributors".

Author
- Implementation prepared for NeverFirstTry/metablend by g-radio.
