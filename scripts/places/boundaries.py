# Step 1b of the summits dataset: the outlines of every country and territory, so that a summit's
# country is the one its position lies in. We follow OpenStreetMap's country boundaries
# (lib/places/areas.js has the rule and what the owner decided for disputed areas).
#
# The outlines are read from a published file, not asked of a query service (owner, 2026-11-14: the
# public Overpass servers were overloaded and one most likely blocked us): Overture Maps, theme
# divisions, type division_area, its newest monthly release. Static files on public storage, ODbL,
# every outline made from an OpenStreetMap boundary relation ("© OpenStreetMap contributors, Overture
# Maps Foundation"). Taken: the rows of subtype country or dependency in their territorial form (the
# relation's own extent, waters included), and Western Sahara, which the file holds as a region under
# Morocco (OpenStreetMap relation 2559126, tagged EH there): handed on under the code EH.
#   -> data/places/boundaries.ndjson            one outline a line: cc, record, updated, area, geometry (GeoJSON)
#   -> data/places/boundaries-summary.json      the release, how many outlines, the newest edit among them
# Needs Python with duckdb (pip install duckdb). About 90 MB of download, a minute or two.
#   python scripts/places/boundaries.py [release]
import json
import os
import sys
import urllib.request

import duckdb

DIR = os.path.join('data', 'places')
OUT = os.path.join(DIR, 'boundaries.ndjson')
SUMMARY = os.path.join(DIR, 'boundaries-summary.json')
WESTERN_SAHARA = 2559126  # the OpenStreetMap relation the file's region row comes from

os.makedirs(DIR, exist_ok=True)
release = sys.argv[1] if len(sys.argv) > 1 else json.load(urllib.request.urlopen('https://stac.overturemaps.org/catalog.json', timeout=60))['latest']
src = f"s3://overturemaps-us-west-2/release/{release}/theme=divisions/type=division_area/*"

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
con.execute(f"""CREATE TABLE b AS
  SELECT CASE WHEN subtype = 'region' THEN 'EH' ELSE country END AS cc,
         sources[1].dataset AS dataset, sources[1].record_id AS record, sources[1].update_time AS updated,
         ST_Area(geometry) AS area, geometry
    FROM read_parquet('{src}', hive_partitioning=1)
   WHERE is_territorial
     AND (subtype IN ('country', 'dependency')
          OR (subtype = 'region' AND country = 'MA' AND sources[1].record_id LIKE 'r{WESTERN_SAHARA}@%'))""")
part = OUT + '.part'
con.execute(f"COPY (SELECT cc, record, updated, area, ST_AsGeoJSON(geometry) AS geometry FROM b ORDER BY cc) TO '{part.replace(os.sep, '/')}' (FORMAT json, ARRAY false)")
areas, newest, eh = con.execute("SELECT count(*), max(updated), count(*) FILTER (WHERE cc = 'EH') FROM b").fetchone()
other = [r[0] for r in con.execute("SELECT DISTINCT cc FROM b WHERE dataset <> 'OpenStreetMap' ORDER BY 1").fetchall()]
twice = [r[0] for r in con.execute("SELECT cc FROM b GROUP BY cc HAVING count(*) > 1 ORDER BY 1").fetchall()]
os.replace(part, OUT)
with open(SUMMARY, 'w', encoding='utf8') as f:
    json.dump({'release': release, 'areas': areas, 'newest': newest, 'westernSahara': eh == 1, 'notFromOpenStreetMap': other, 'twice': twice}, f, indent=1)
print(f"outlines: {areas} from release {release}, newest boundary edit {newest}; Western Sahara {'there' if eh == 1 else 'MISSING'}"
      + (f"; NOT from OpenStreetMap: {', '.join(other)}" if other else '') + (f"; more than one outline for {', '.join(twice)}" if twice else ''))
