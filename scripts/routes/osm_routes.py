#!/usr/bin/env python3
# The marked routes around summits, read from an OpenStreetMap extract on disk (.osm.pbf, Geofabrik) and
# written in the shape of the two OpenStreetMap API answers the site's route finder reads (lib/route/find.js):
# the box around the summit (map.json) and each route with its ways and nodes (relation/<id>/full.json).
# No request to any service. One file per summit: <out dir>/<summit id>.json
#   { "map": {"elements": [...]}, "full": {"<relation id>": {"elements": [...]}}, "cut": {"<relation id>": n} }
# cut: member ways of a route that the extract does not hold (the route leaves the extract): n of them.
# Four passes over the file, because an extract lists every node before the first way and every way before
# the first relation: (1) the nodes in the boxes and every walking route, (2) those routes' ways that touch
# a box, (3) every way of the routes that touch one, (4) those ways' nodes.
#   python osm_routes.py <in.osm.pbf> <summits.json: [{"id", "lat", "lon"}]> <out dir>
import json
import math
import os
import sys

import osmium

BOX_LAT, BOX_LON = 0.006, 0.009  # the finder's box (lib/route/find.js)
ROUTES = (('route', 'hiking'), ('route', 'foot'), ('route', 'mountain_hiking'))  # lib/route/osm.js
KIND = {'n': 'node', 'w': 'way', 'r': 'relation'}


def main(src, summits_file, out_dir):
    with open(summits_file, encoding='utf-8') as f:
        summits = json.load(f)
    boxes = [(s['lat'] - BOX_LAT, s['lat'] + BOX_LAT, s['lon'] - BOX_LON, s['lon'] + BOX_LON) for s in summits]
    # a coarse grid first: nearly every node of an extract is far from every summit
    cells = {}
    for k, (lat1, lat2, lon1, lon2) in enumerate(boxes):
        for cy in range(math.floor(lat1 * 50), math.floor(lat2 * 50) + 1):
            for cx in range(math.floor(lon1 * 50), math.floor(lon2 * 50) + 1):
                cells.setdefault((cy, cx), []).append(k)

    # 1: nodes in a box (id -> the boxes it lies in), and every walking route with its members
    in_box, relations = {}, {}
    floor = math.floor
    found = osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.RELATION) \
        .with_filter(osmium.filter.TagFilter(*ROUTES).enable_for(osmium.osm.RELATION))
    for obj in found:
        if obj.is_node():
            lat, lon = obj.lat, obj.lon
            near = cells.get((floor(lat * 50), floor(lon * 50)))
            if near:
                hit = [k for k in near if boxes[k][0] <= lat <= boxes[k][1] and boxes[k][2] <= lon <= boxes[k][3]]
                if hit:
                    in_box[obj.id] = hit
        else:
            relations[obj.id] = ({t.k: t.v for t in obj.tags}, [(m.type, m.ref, m.role) for m in obj.members])
    member_of = {}
    for rid, (_, members) in relations.items():
        for kind, ref, _ in members:
            if kind == 'w':
                member_of.setdefault(ref, []).append(rid)

    # 2: the routes' ways that have a node in a box
    touching = {}
    if in_box and member_of:
        for way in osmium.FileProcessor(src, osmium.osm.WAY).with_filter(osmium.filter.IdFilter(member_of.keys())):
            refs = [n.ref for n in way.nodes]
            if any(r in in_box for r in refs):
                touching[way.id] = refs
    near_summit = [set() for _ in summits]  # per summit: the routes with a way in its box
    for wid, refs in touching.items():
        for k in {k for r in refs for k in in_box.get(r, ())}:
            near_summit[k].update(member_of[wid])
    wanted = set().union(*near_summit) if near_summit else set()

    # 3: every way of those routes, 4: their nodes
    ways, nodes = {}, {}
    need_ways = {ref for rid in wanted for kind, ref, _ in relations[rid][1] if kind == 'w'}
    if need_ways:
        for way in osmium.FileProcessor(src, osmium.osm.WAY).with_filter(osmium.filter.IdFilter(need_ways)):
            ways[way.id] = ([n.ref for n in way.nodes], {t.k: t.v for t in way.tags})
        need_nodes = {r for refs, _ in ways.values() for r in refs}
        for node in osmium.FileProcessor(src, osmium.osm.NODE).with_filter(osmium.filter.IdFilter(need_nodes)):
            if node.location.valid():
                nodes[node.id] = (round(node.lat, 7), round(node.lon, 7))

    def node_el(nid):
        return {'type': 'node', 'id': nid, 'lat': nodes[nid][0], 'lon': nodes[nid][1]}

    def way_el(wid):
        return {'type': 'way', 'id': wid, 'nodes': ways[wid][0], 'tags': ways[wid][1]}

    def rel_el(rid):
        tags, members = relations[rid]
        return {'type': 'relation', 'id': rid, 'tags': tags, 'members': [{'type': KIND[k], 'ref': ref, 'role': role} for k, ref, role in members]}

    os.makedirs(out_dir, exist_ok=True)
    for k, s in enumerate(summits):
        rids = sorted(near_summit[k])  # the API lists relations by id
        box_ways = sorted({ref for rid in rids for kind, ref, _ in relations[rid][1] if kind == 'w' and ref in touching and ref in ways})
        box_nodes = sorted({r for wid in box_ways for r in ways[wid][0] if r in nodes})
        full, cut = {}, {}
        for rid in rids:
            mine = [ref for kind, ref, _ in relations[rid][1] if kind == 'w']
            held = [ref for ref in mine if ref in ways]
            if len(held) < len(mine):
                cut[rid] = len(mine) - len(held)
            mine_nodes = sorted({r for wid in held for r in ways[wid][0] if r in nodes})
            full[rid] = {'elements': [rel_el(rid)] + [way_el(w) for w in sorted(set(held))] + [node_el(n) for n in mine_nodes]}
        out = {'map': {'elements': [node_el(n) for n in box_nodes] + [way_el(w) for w in box_ways] + [rel_el(r) for r in rids]}, 'full': full, 'cut': cut}
        with open(os.path.join(out_dir, f"{s['id']}.json"), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False)
    return {'summits': len(summits), 'nodes_in_boxes': len(in_box), 'walking_routes': len(relations), 'routes_near': len(wanted), 'with_ways_outside': sum(1 for rid in wanted if any(k == 'w' and ref not in ways for k, ref, _ in relations[rid][1]))}


if __name__ == '__main__':
    print(json.dumps(main(*sys.argv[1:4])))
