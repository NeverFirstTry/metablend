#!/usr/bin/env python3
# Terrain heights from Copernicus GLO-90 tiles on disk, for scripts/routes/local.mjs. Reads one line of
# JSON per request on stdin ([[lat, lon], ...]) and answers with one line ([height or null, ...]), until
# stdin closes. A tile that is not on disk is fetched once from the programme's public bucket (one file at a
# time); a tile that does not exist there is sea, and its points get null. Needs rasterio.
#   python tile_heights.py <tiles dir> [between|cell|shifted]
# between: the height between the four cell centres around the point (the tile's own georeference).
# cell: the cell's own value. shifted: between, read half a cell up and to the left (see the comparison in
# the changelog entry of this script: it came closest to Open-Meteo's answers, which read the same tiles).
import json
import math
import os
import sys
import urllib.error
import urllib.request

import rasterio

BUCKET = 'https://copernicus-dem-90m.s3.amazonaws.com'
AGENT = 'MetaBlend/1.0 (https://metablend.app; info@metablend.app)'
tiles_dir = sys.argv[1]
reading = sys.argv[2] if len(sys.argv) > 2 else 'between'
os.makedirs(tiles_dir, exist_ok=True)
SEA = os.path.join(tiles_dir, 'no-tile.txt')
sea = set(open(SEA, encoding='utf-8').read().split()) if os.path.exists(SEA) else set()
open_tiles = {}  # at most KEEP at a time: a tile is 1,200 x 1,200 values
KEEP = 24


def name_for(lat, lon):
    return 'Copernicus_DSM_COG_30_%s%02d_00_%s%03d_00_DEM' % ('N' if lat >= 0 else 'S', abs(math.floor(lat)), 'E' if lon >= 0 else 'W', abs(math.floor(lon)))


def tile(lat, lon):
    name = name_for(lat, lon)
    if name in sea:
        return None
    if name not in open_tiles:
        path = os.path.join(tiles_dir, name + '.tif')
        if not os.path.exists(path):
            try:
                request = urllib.request.Request('%s/%s/%s.tif' % (BUCKET, name, name), headers={'User-Agent': AGENT})
                with urllib.request.urlopen(request, timeout=120) as answer, open(path + '.part', 'wb') as f:
                    f.write(answer.read())
                os.replace(path + '.part', path)
                sys.stderr.write('tile fetched: %s\n' % name)
            except urllib.error.HTTPError as e:
                if e.code not in (403, 404):
                    raise
                sea.add(name)
                with open(SEA, 'a', encoding='utf-8') as f:
                    f.write(name + '\n')
                return None
        if len(open_tiles) >= KEEP:
            open_tiles.pop(next(iter(open_tiles)))[0].close()
        src = rasterio.open(path)
        open_tiles[name] = (src, src.read(1))
    return open_tiles[name]


# shortcut: in the outermost half cell of a tile the neighbouring tile is not read (the tile's own edge
# values stand in, at most 45 m to the side); upgrade when a route's heights at a tile edge matter.
def between(src, band, fx, fy):
    x0 = min(max(int(math.floor(fx)), 0), src.width - 2)
    y0 = min(max(int(math.floor(fy)), 0), src.height - 2)
    tx = min(max(fx - x0, 0.0), 1.0)
    ty = min(max(fy - y0, 0.0), 1.0)
    a, b, c, d = float(band[y0, x0]), float(band[y0, x0 + 1]), float(band[y0 + 1, x0]), float(band[y0 + 1, x0 + 1])
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty


def height(lat, lon):
    t = tile(lat, lon)
    if t is None:
        return None
    src, band = t
    if reading == 'cell':
        row, col = src.index(lon, lat)
        return float(band[min(max(row, 0), src.height - 1), min(max(col, 0), src.width - 1)])
    fx, fy = ~src.transform * (lon, lat)
    shift = 1.0 if reading == 'shifted' else 0.5
    return round(between(src, band, fx - shift, fy - shift), 1)


for line in sys.stdin:
    if not line.strip():
        continue
    sys.stdout.write(json.dumps([height(lat, lon) for lat, lon in json.loads(line)]) + '\n')
    sys.stdout.flush()
