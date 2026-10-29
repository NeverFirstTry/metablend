#!/usr/bin/env python3
# Summits, volcanoes and huts with a name from an OpenStreetMap extract
# (.osm.pbf), one JSON line each: {"id": "N123", "lat": …, "lon": …, "tags": {…}}
# with only the tags we keep. Huts mapped as buildings (ways) get the middle of
# their nodes, read in a second pass for just those nodes. Everything else —
# heights, names, notability — is worked out in lib/places/rows.js.
#   python scripts/places/osm_extract.py <in.osm.pbf> <out.ndjson>
import json
import sys

import osmium

WANT = (('natural', 'peak'), ('natural', 'volcano'), ('tourism', 'alpine_hut'), ('tourism', 'wilderness_hut'))
LANGS = ('en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'zh-Hans', 'ko')
KEEP = {'name', 'natural', 'tourism', 'ele', 'wikidata', 'wikipedia', 'summit:cross', *(f'name:{lang}' for lang in LANGS)}


def kept(obj):
    return {t.k: t.v for t in obj.tags if t.k in KEEP}


def line(oid, lat, lon, tags):
    return json.dumps({'id': oid, 'lat': round(lat, 6), 'lon': round(lon, 6), 'tags': tags}, ensure_ascii=False) + '\n'


def main(src, out):
    ways, nodes = {}, 0
    with open(out, 'w', encoding='utf-8') as f:
        named = osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.WAY) \
            .with_filter(osmium.filter.KeyFilter('name')) \
            .with_filter(osmium.filter.TagFilter(*WANT))
        for obj in named:
            if obj.is_node():
                if obj.location.valid():
                    f.write(line(f'N{obj.id}', obj.location.lat, obj.location.lon, kept(obj)))
                    nodes += 1
            else:
                ways[obj.id] = ([n.ref for n in obj.nodes], kept(obj))
        written = 0
        if ways:
            need = {ref for refs, _ in ways.values() for ref in refs}
            loc = {}
            for node in osmium.FileProcessor(src, osmium.osm.NODE).with_filter(osmium.filter.IdFilter(need)):
                if node.location.valid():
                    loc[node.id] = (node.location.lat, node.location.lon)
            for wid, (refs, tags) in ways.items():
                pts = [loc[r] for r in refs if r in loc]
                if pts:
                    f.write(line(f'W{wid}', sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), tags))
                    written += 1
    print(json.dumps({'nodes': nodes, 'ways': written}))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
