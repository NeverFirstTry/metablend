// A region's name for a reader (owner, 2026-11-13): in the reader's language where GeoNames has one
// ("Tirol" for German, "Tirolo" for Italian), else the English name the towns table carries ("Tyrol").
// region-names.json is written by scripts/places/build.mjs, keyed by country and English name, and holds
// only the names that differ from the English one. GeoNames marks few of these names as checked; an unmarked
// one can be the name of a part of the region (Trentino-Alto Adige in Dutch is its entry for South Tyrol).
// For showing only: what a place is filed under keeps the English name (lib/geocode.js).
import names from './region-names.json'

export const regionIn = (cc, region, lang) => (region ? names[`${cc}|${region}`]?.[lang] ?? region : null)
