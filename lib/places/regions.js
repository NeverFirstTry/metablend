// A region's name for a reader (owner, 2026-11-13): in the reader's language where GeoNames has a name it
// marks as preferred or short ("Tirol" for German), else the English name the towns table carries ("Tyrol").
// region-names.json is written by scripts/places/build.mjs, keyed by country and English name, and holds
// only the names that differ from the English one. Unmarked names are left out on purpose: some belong to a
// part of the region (Trentino-Alto Adige in Dutch was GeoNames' entry for South Tyrol).
// For showing only: what a place is filed under keeps the English name (lib/geocode.js).
import names from './region-names.json'

// Kept by hand, where GeoNames has no marked name and readers expect one. A rebuild does not touch these.
const BY_HAND = { 'IT|Trentino-Alto Adige': { de: 'Trentino-Südtirol' } }

export const regionIn = (cc, region, lang) => (region ? BY_HAND[`${cc}|${region}`]?.[lang] ?? names[`${cc}|${region}`]?.[lang] ?? region : null)
