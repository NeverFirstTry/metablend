// Express router exposing /api/geocode/search and /api/geocode/reverse
const express = require('express');
const router = express.Router();
const geocoder = require('../services/geocoder');

/*
  GET /api/geocode/search?q=...&limit=5&countrycodes=us
  GET /api/geocode/reverse?lat=...&lon=...&zoom=18
*/

router.get('/search', async (req, res) => {
  try {
    const { q, limit, viewbox, countrycodes, polygon_geojson } = req.query;
    if (!q) return res.status(400).json({ error: 'missing query parameter q' });
    const result = await geocoder.search(q, {
      limit: limit ? Number(limit) : undefined,
      viewbox,
      countrycodes,
      polygon_geojson: polygon_geojson ? Number(polygon_geojson) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('geocode/search error', err);
    res.status(500).json({ error: err.message || 'geocode search failed' });
  }
});

router.get('/reverse', async (req, res) => {
  try {
    const { lat, lon, zoom } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'missing lat or lon' });
    const result = await geocoder.reverse(Number(lat), Number(lon), { zoom: zoom ? Number(zoom) : 18 });
    res.json(result);
  } catch (err) {
    console.error('geocode/reverse error', err);
    res.status(500).json({ error: err.message || 'geocode reverse failed' });
  }
});

module.exports = router;