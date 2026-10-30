#!/usr/bin/env python3
# Summits, volcanoes and huts with a name from an OpenStreetMap extract
# (.osm.pbf, or "-": streamed in by scripts/places/osm.mjs, never stored), one
# JSON line each: {"id": "N123", "lat": …, "lon": …, "tags": {…}} with only
# the tags we keep. Huts mapped as buildings (ways) get the middle of their
# nodes — but an extract lists every node before the first way, so those come
# from a second pass, which stops where the ways begin. Everything else —
# heights, names, notability — is worked out in lib/places/rows.js.
#   python osm_extract.py named <in.osm.pbf|-> <out.ndjson> <ways.json>
#   python osm_extract.py way-nodes <in.osm.pbf|-> <ways.json> <out.ndjson>   (adds the huts mapped as ways)
import json
import os
import sys

import osmium

WANT = (('natural', 'peak'), ('natural', 'volcano'), ('tourism', 'alpine_hut'), ('tourism', 'wilderness_hut'))
LANGS = ('en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'zh-Hans', 'ko')
KEEP = {'name', 'natural', 'tourism', 'ele', 'wikidata', 'wikipedia', 'summit:cross', *(f'name:{lang}' for lang in LANGS)}


def source(src):
    return osmium.io.File('-', 'pbf') if src == '-' else src


def kept(obj):
    return {t.k: t.v for t in obj.tags if t.k in KEEP}


def line(oid, lat, lon, tags):
    return json.dumps({'id': oid, 'lat': round(lat, 6), 'lon': round(lon, 6), 'tags': tags}, ensure_ascii=False) + '\n'


# Pass 1: summits and huts mapped as points; huts mapped as ways with their
# node ids, for pass 2.
def named(src, out, ways_file):
    ways, nodes = {}, 0
    with open(out, 'w', encoding='utf-8') as f:
        found = osmium.FileProcessor(source(src), osmium.osm.NODE | osmium.osm.WAY) \
            .with_filter(osmium.filter.KeyFilter('name')) \
            .with_filter(osmium.filter.TagFilter(*WANT))
        for obj in found:
            if obj.is_node():
                if obj.location.valid():
                    f.write(line(f'N{obj.id}', obj.location.lat, obj.location.lon, kept(obj)))
                    nodes += 1
            else:
                ways[obj.id] = ([n.ref for n in obj.nodes], kept(obj))
    with open(ways_file, 'w', encoding='utf-8') as f:
        json.dump(ways, f, ensure_ascii=False)
    return {'nodes': nodes, 'ways': len(ways)}


# Pass 2: those ways' nodes, then each way at the middle of them. The first
# way means every node has been read: stop there (no need for the rest).
def way_nodes(src, ways_file, out):
    with open(ways_file, encoding='utf-8') as f:
        ways = json.load(f)
    need = {ref for refs, _ in ways.values() for ref in refs}
    loc, reached_ways = {}, False
    # kept open to the end: closing the reader would read the rest of the stream first
    global unfinished
    unfinished = iter(osmium.FileProcessor(source(src), osmium.osm.NODE | osmium.osm.WAY)
                      .with_filter(osmium.filter.IdFilter(need).enable_for(osmium.osm.NODE)))
    for obj in unfinished:
        if obj.is_way():
            reached_ways = True
            break
        if obj.location.valid():
            loc[obj.id] = (obj.location.lat, obj.location.lon)
    written = 0
    with open(out, 'a', encoding='utf-8') as f:
        for wid, (refs, tags) in ways.items():
            pts = [loc[r] for r in refs if r in loc]
            if pts:
                f.write(line(f'W{wid}', sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), tags))
                written += 1
    return {'ways': written, 'missing_nodes': len(need - loc.keys()), 'reached_ways': reached_ways}


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    result = named(*args) if mode == 'named' else way_nodes(*args)
    print(json.dumps(result), flush=True)
    # the stream is left unread after pass 2: don't wait for the reader to drain it
    os._exit(0)
