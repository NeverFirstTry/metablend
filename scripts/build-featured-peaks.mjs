// Builds lib/hike/featured.json: hand-picked peaks and huts worldwide with
// their published heights, region and the SAC grade of the usual route
// (T1–T6 hiking; L / WS / ZS / S over glaciers or with climbing). Exact
// coordinates come from OpenStreetMap via Photon — the match nearest the hint,
// within 3 km. Refuses to write a broken list. Re-run after editing LIST:
//   node scripts/build-featured-peaks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../lib/geo.js'
import { checkPeak } from '../lib/hike/featured-list.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', 'featured.json')
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// [id, display name, OSM search text, hint lat, hint lon, height m, country, kind, region, grade, aka]
const LIST = [
  // ── Eastern Alps ──
  ['grossglockner', 'Großglockner', 'Großglockner', 47.0745, 12.6945, 3798, 'AT', 'peak', 'eastern-alps', 'WS', ['Grossglockner']],
  ['wildspitze', 'Wildspitze', 'Wildspitze', 46.885, 10.867, 3768, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['grossvenediger', 'Großvenediger', 'Großvenediger', 47.109, 12.346, 3657, 'AT', 'peak', 'eastern-alps', 'L', ['Grossvenediger']],
  ['olperer', 'Olperer', 'Olperer', 47.052, 11.662, 3476, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['kitzsteinhorn', 'Kitzsteinhorn', 'Kitzsteinhorn', 47.188, 12.687, 3203, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['hoher-dachstein', 'Hoher Dachstein', 'Hoher Dachstein', 47.475, 13.606, 2995, 'AT', 'peak', 'eastern-alps', 'WS', ['Dachstein']],
  ['hochkoenig', 'Hochkönig', 'Hochkönig', 47.420, 13.062, 2941, 'AT', 'peak', 'eastern-alps', 'T4', ['Hochkoenig']],
  ['hafelekarspitze', 'Hafelekarspitze (Nordkette)', 'Hafelekarspitze', 47.312, 11.386, 2334, 'AT', 'peak', 'eastern-alps', 'T2', ['Nordkette']],
  ['hochschwab', 'Hochschwab', 'Hochschwab', 47.618, 15.142, 2277, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['patscherkofel', 'Patscherkofel', 'Patscherkofel', 47.209, 11.461, 2246, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['schneeberg', 'Schneeberg (Klosterwappen)', 'Klosterwappen', 47.767, 15.807, 2076, 'AT', 'peak', 'eastern-alps', 'T2', ['Schneeberg']],
  ['rax', 'Rax (Heukuppe)', 'Heukuppe', 47.689, 15.689, 2007, 'AT', 'peak', 'eastern-alps', 'T2', ['Rax', 'Raxalpe']],
  ['oetscher', 'Ötscher', 'Ötscher', 47.863, 15.201, 1893, 'AT', 'peak', 'eastern-alps', 'T3', ['Oetscher']],
  ['schafberg', 'Schafberg', 'Schafberg', 47.776, 13.434, 1783, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['traunstein', 'Traunstein', 'Traunstein', 47.873, 13.834, 1691, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['erzherzog-johann-huette', 'Erzherzog-Johann-Hütte', 'Erzherzog-Johann-Hütte', 47.069, 12.697, 3454, 'AT', 'hut', 'eastern-alps', 'L', ['Adlersruhe', 'Erzherzog Johann Huette']],
  ['schiestlhaus', 'Schiestlhaus', 'Schiestlhaus', 47.622, 15.148, 2153, 'AT', 'hut', 'eastern-alps', 'T2'],
  ['grosser-priel', 'Großer Priel', 'Großer Priel', 47.717, 14.063, 2515, 'AT', 'peak', 'eastern-alps', 'T3', ['Grosser Priel']],
  ['hoher-sonnblick', 'Hoher Sonnblick', 'Hoher Sonnblick', 47.054, 12.957, 3106, 'AT', 'peak', 'eastern-alps', 'L', ['Sonnblick']],
  ['ankogel', 'Ankogel', 'Ankogel', 47.050, 13.247, 3252, 'AT', 'peak', 'eastern-alps', 'L'],
  ['hochalmspitze', 'Hochalmspitze', 'Hochalmspitze', 47.015, 13.320, 3360, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['weisskugel', 'Weißkugel', 'Weißkugel', 46.799, 10.727, 3739, 'AT', 'peak', 'eastern-alps', 'WS', ['Weisskugel', 'Palla Bianca']],
  ['similaun', 'Similaun', 'Similaun', 46.765, 10.879, 3606, 'AT', 'peak', 'eastern-alps', 'L'],
  ['habicht', 'Habicht', 'Habicht', 47.045, 11.287, 3277, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['serles', 'Serles', 'Serles', 47.120, 11.377, 2717, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['birkkarspitze', 'Birkkarspitze', 'Birkkarspitze', 47.411, 11.437, 2749, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['piz-buin', 'Piz Buin', 'Piz Buin', 46.844, 10.119, 3312, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['schesaplana', 'Schesaplana', 'Schesaplana', 47.053, 9.708, 2964, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['grimming', 'Grimming', 'Grimming', 47.521, 14.010, 2351, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['gaisberg', 'Gaisberg', 'Gaisberg', 47.805, 13.112, 1287, 'AT', 'peak', 'eastern-alps', 'T1'],
  ['schoeckl', 'Schöckl', 'Schöckl', 47.199, 15.468, 1445, 'AT', 'peak', 'eastern-alps', 'T1', ['Schoeckl']],
  ['gerlitzen', 'Gerlitzen', 'Gerlitzen', 46.695, 13.916, 1911, 'AT', 'peak', 'eastern-alps', 'T1'],
  ['dobratsch', 'Dobratsch', 'Dobratsch', 46.603, 13.672, 2166, 'AT', 'peak', 'eastern-alps', 'T2', ['Villacher Alpe']],
  ['untersberg', 'Untersberg (Salzburger Hochthron)', 'Salzburger Hochthron', 47.712, 13.009, 1853, 'AT', 'peak', 'eastern-alps', 'T2', ['Untersberg']],
  ['zwoelferhorn', 'Zwölferhorn', 'Zwölferhorn', 47.743, 13.353, 1522, 'AT', 'peak', 'eastern-alps', 'T1', ['Zwoelferhorn']],
  ['kitzbueheler-horn', 'Kitzbüheler Horn', 'Kitzbüheler Horn', 47.464, 12.425, 1996, 'AT', 'peak', 'eastern-alps', 'T2', ['Kitzbueheler Horn']],
  ['hohe-salve', 'Hohe Salve', 'Hohe Salve', 47.477, 12.189, 1829, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['schmittenhoehe', 'Schmittenhöhe', 'Schmittenhöhe', 47.328, 12.737, 1965, 'AT', 'peak', 'eastern-alps', 'T1', ['Schmittenhoehe']],
  ['loser', 'Loser', 'Loser', 47.663, 13.784, 1838, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['zugspitze', 'Zugspitze', 'Zugspitze', 47.421, 10.985, 2962, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['watzmann', 'Watzmann (Mittelspitze)', 'Watzmann', 47.555, 12.922, 2713, 'DE', 'peak', 'eastern-alps', 'T5', ['Watzmann']],
  ['alpspitze', 'Alpspitze', 'Alpspitze', 47.414, 11.052, 2628, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['wendelstein', 'Wendelstein', 'Wendelstein', 47.703, 12.012, 1838, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['herzogstand', 'Herzogstand', 'Herzogstand', 47.614, 11.308, 1731, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['hochvogel', 'Hochvogel', 'Hochvogel', 47.379, 10.437, 2592, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['nebelhorn', 'Nebelhorn', 'Nebelhorn', 47.421, 10.344, 2224, 'DE', 'peak', 'eastern-alps', 'T3'],
  ['hochkalter', 'Hochkalter', 'Hochkalter', 47.569, 12.869, 2607, 'DE', 'peak', 'eastern-alps', 'T5'],
  ['hoher-goell', 'Hoher Göll', 'Hoher Göll', 47.594, 13.065, 2522, 'DE', 'peak', 'eastern-alps', 'T4', ['Hoher Goell']],
  ['benediktenwand', 'Benediktenwand', 'Benediktenwand', 47.653, 11.463, 1801, 'DE', 'peak', 'eastern-alps', 'T3'],
  ['wank', 'Wank', 'Wank', 47.513, 11.141, 1780, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['wallberg', 'Wallberg', 'Wallberg', 47.664, 11.793, 1722, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['jenner', 'Jenner', 'Jenner', 47.579, 13.022, 1874, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['hochfelln', 'Hochfelln', 'Hochfelln', 47.761, 12.558, 1674, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['piz-bernina', 'Piz Bernina', 'Piz Bernina', 46.382, 9.908, 4049, 'CH', 'peak', 'eastern-alps', 'ZS'],
  ['piz-languard', 'Piz Languard', 'Piz Languard', 46.505, 9.956, 3262, 'CH', 'peak', 'eastern-alps', 'T3'],
  ['ortler', 'Ortler', 'Ortler', 46.509, 10.545, 3905, 'IT', 'peak', 'eastern-alps', 'WS', ['Ortles']],
  ['hochfeiler', 'Hochfeiler', 'Hochfeiler', 46.973, 11.728, 3509, 'IT', 'peak', 'eastern-alps', 'L', ['Gran Pilastro']],
  ['jof-di-montasio', 'Jôf di Montasio', 'Jôf di Montasio', 46.438, 13.431, 2754, 'IT', 'peak', 'eastern-alps', 'T5', ['Montasch']],
  ['monte-baldo', 'Monte Baldo (Cima Valdritta)', 'Cima Valdritta', 45.717, 10.856, 2218, 'IT', 'peak', 'eastern-alps', 'T3', ['Monte Baldo']],
  ['monte-grappa', 'Monte Grappa', 'Monte Grappa', 45.871, 11.802, 1775, 'IT', 'peak', 'eastern-alps', 'T1'],
  ['triglav', 'Triglav', 'Triglav', 46.378, 13.837, 2864, 'SI', 'peak', 'eastern-alps', 'T5'],
  ['mangart', 'Mangart', 'Mangart', 46.443, 13.654, 2679, 'SI', 'peak', 'eastern-alps', 'T4', ['Mangrt']],
  ['krn', 'Krn', 'Krn', 46.267, 13.659, 2244, 'SI', 'peak', 'eastern-alps', 'T3'],
  // ── Western Alps ──
  ['dufourspitze', 'Dufourspitze (Monte Rosa)', 'Dufourspitze', 45.937, 7.867, 4634, 'CH', 'peak', 'western-alps', 'ZS', ['Monte Rosa']],
  ['matterhorn', 'Matterhorn', 'Matterhorn', 45.976, 7.658, 4478, 'CH', 'peak', 'western-alps', 'ZS', ['Cervino']],
  ['jungfrau', 'Jungfrau', 'Jungfrau', 46.537, 7.962, 4158, 'CH', 'peak', 'western-alps', 'ZS'],
  ['eiger', 'Eiger', 'Eiger', 46.577, 8.005, 3967, 'CH', 'peak', 'western-alps', 'ZS'],
  ['titlis', 'Titlis', 'Titlis', 46.772, 8.437, 3238, 'CH', 'peak', 'western-alps', 'L'],
  ['saentis', 'Säntis', 'Säntis', 47.249, 9.343, 2502, 'CH', 'peak', 'western-alps', 'T3', ['Saentis']],
  ['pilatus', 'Pilatus (Tomlishorn)', 'Tomlishorn', 46.974, 8.253, 2128, 'CH', 'peak', 'western-alps', 'T2', ['Pilatus']],
  ['rigi', 'Rigi Kulm', 'Rigi', 47.056, 8.485, 1798, 'CH', 'peak', 'western-alps', 'T1', ['Rigi']],
  ['hoernlihuette', 'Hörnlihütte', 'Hörnlihütte', 45.982, 7.674, 3260, 'CH', 'hut', 'western-alps', 'T3', ['Hornlihutte', 'Hoernlihuette']],
  ['weissmies', 'Weissmies', 'Weissmies', 46.128, 8.012, 4017, 'CH', 'peak', 'western-alps', 'L'],
  ['allalinhorn', 'Allalinhorn', 'Allalinhorn', 46.046, 7.895, 4027, 'CH', 'peak', 'western-alps', 'L'],
  ['breithorn', 'Breithorn', 'Breithorn', 45.941, 7.746, 4164, 'CH', 'peak', 'western-alps', 'L'],
  ['lagginhorn', 'Lagginhorn', 'Lagginhorn', 46.157, 8.003, 4010, 'CH', 'peak', 'western-alps', 'WS'],
  ['dom', 'Dom', 'Dom', 46.094, 7.859, 4545, 'CH', 'peak', 'western-alps', 'WS'],
  ['weisshorn', 'Weisshorn', 'Weisshorn', 46.101, 7.716, 4506, 'CH', 'peak', 'western-alps', 'ZS'],
  ['finsteraarhorn', 'Finsteraarhorn', 'Finsteraarhorn', 46.537, 8.126, 4274, 'CH', 'peak', 'western-alps', 'WS'],
  ['moench', 'Mönch', 'Mönch', 46.558, 7.997, 4107, 'CH', 'peak', 'western-alps', 'WS', ['Moench']],
  ['toedi', 'Tödi', 'Tödi', 46.811, 8.915, 3614, 'CH', 'peak', 'western-alps', 'WS', ['Toedi']],
  ['grand-combin', 'Grand Combin', 'Grand Combin de Grafeneire', 45.938, 7.299, 4314, 'CH', 'peak', 'western-alps', 'WS'],
  ['schilthorn', 'Schilthorn', 'Schilthorn', 46.558, 7.835, 2970, 'CH', 'peak', 'western-alps', 'T3'],
  ['grosser-mythen', 'Grosser Mythen', 'Grosser Mythen', 47.031, 8.681, 1899, 'CH', 'peak', 'western-alps', 'T3'],
  ['niesen', 'Niesen', 'Niesen', 46.645, 7.651, 2362, 'CH', 'peak', 'western-alps', 'T2'],
  ['stanserhorn', 'Stanserhorn', 'Stanserhorn', 46.929, 8.340, 1898, 'CH', 'peak', 'western-alps', 'T2'],
  ['maennlichen', 'Männlichen', 'Männlichen', 46.613, 7.940, 2343, 'CH', 'peak', 'western-alps', 'T1', ['Maennlichen']],
  ['faulhorn', 'Faulhorn', 'Faulhorn', 46.675, 8.022, 2681, 'CH', 'peak', 'western-alps', 'T2'],
  ['brienzer-rothorn', 'Brienzer Rothorn', 'Brienzer Rothorn', 46.787, 8.047, 2350, 'CH', 'peak', 'western-alps', 'T2'],
  ['gornergrat', 'Gornergrat', 'Gornergrat', 45.983, 7.785, 3135, 'CH', 'peak', 'western-alps', 'T1'],
  ['monte-generoso', 'Monte Generoso', 'Monte Generoso', 45.931, 9.020, 1701, 'CH', 'peak', 'western-alps', 'T1'],
  ['gran-paradiso', 'Gran Paradiso', 'Gran Paradiso', 45.518, 7.266, 4061, 'IT', 'peak', 'western-alps', 'L'],
  ['monviso', 'Monviso', 'Monviso', 44.667, 7.090, 3841, 'IT', 'peak', 'western-alps', 'WS', ['Monte Viso']],
  ['mont-blanc', 'Mont Blanc', 'Mont Blanc', 45.833, 6.865, 4806, 'FR', 'peak', 'western-alps', 'WS', ['Monte Bianco']],
  ['aiguille-du-midi', 'Aiguille du Midi', 'Aiguille du Midi', 45.879, 6.887, 3842, 'FR', 'peak', 'western-alps', 'T1'],
  ['refuge-du-gouter', 'Refuge du Goûter', 'Refuge du Goûter', 45.851, 6.832, 3835, 'FR', 'hut', 'western-alps', 'WS', ['Gouter']],
  ['barre-des-ecrins', 'Barre des Écrins', 'Barre des Écrins', 44.922, 6.360, 4102, 'FR', 'peak', 'western-alps', 'WS', ['Barre des Ecrins']],
  ['grande-casse', 'Grande Casse', 'Grande Casse', 45.405, 6.827, 3855, 'FR', 'peak', 'western-alps', 'WS'],
  ['mont-buet', 'Mont Buet', 'Mont Buet', 46.025, 6.851, 3096, 'FR', 'peak', 'western-alps', 'T3'],
  ['le-brevent', 'Le Brévent', 'Le Brévent', 45.935, 6.838, 2525, 'FR', 'peak', 'western-alps', 'T2', ['Brevent']],
  ['mont-ventoux', 'Mont Ventoux', 'Mont Ventoux', 44.174, 5.279, 1909, 'FR', 'peak', 'western-alps', 'T1'],
  // ── Dolomites ──
  ['marmolada', 'Marmolada (Punta Penia)', 'Punta Penia', 46.434, 11.851, 3343, 'IT', 'peak', 'dolomites', 'L', ['Marmolada']],
  ['tre-cime', 'Drei Zinnen (Große Zinne)', 'Große Zinne', 46.619, 12.305, 2999, 'IT', 'peak', 'dolomites', 'ZS', ['Tre Cime', 'Cima Grande', 'Drei Zinnen']],
  ['rifugio-auronzo', 'Rifugio Auronzo', 'Rifugio Auronzo', 46.612, 12.296, 2320, 'IT', 'hut', 'dolomites', 'T1'],
  ['piz-boe', 'Piz Boè', 'Piz Boè', 46.509, 11.829, 3152, 'IT', 'peak', 'dolomites', 'T3', ['Piz Boe']],
  ['langkofel', 'Langkofel', 'Langkofel', 46.523, 11.731, 3181, 'IT', 'peak', 'dolomites', 'ZS', ['Sassolungo']],
  ['seceda', 'Seceda', 'Seceda', 46.600, 11.727, 2519, 'IT', 'peak', 'dolomites', 'T2'],
  ['sass-pordoi', 'Sass Pordoi', 'Sas de Pordoi', 46.499, 11.813, 2952, 'IT', 'peak', 'dolomites', 'T3', ['Sas de Pordoi']],
  ['piccolo-lagazuoi', 'Lagazuoi', 'Piccolo Lagazuoi', 46.528, 12.009, 2778, 'IT', 'peak', 'dolomites', 'T3', ['Piccolo Lagazuoi']],
  ['tofana-di-rozes', 'Tofana di Rozes', 'Tofana di Rozes', 46.539, 12.053, 3225, 'IT', 'peak', 'dolomites', 'T5'],
  ['antelao', 'Antelao', 'Antelao', 46.452, 12.262, 3264, 'IT', 'peak', 'dolomites', 'WS'],
  ['civetta', 'Civetta', 'Civetta', 46.381, 12.054, 3220, 'IT', 'peak', 'dolomites', 'WS'],
  ['pelmo', 'Monte Pelmo', 'Monte Pelmo', 46.428, 12.137, 3168, 'IT', 'peak', 'dolomites', 'WS', ['Pelmo']],
  ['schlern', 'Schlern (Petz)', 'Petz', 46.504, 11.580, 2563, 'IT', 'peak', 'dolomites', 'T2', ['Schlern', 'Sciliar']],
  ['peitlerkofel', 'Peitlerkofel', 'Peitlerkofel', 46.663, 11.811, 2875, 'IT', 'peak', 'dolomites', 'T4', ['Sass de Putia']],
  ['nuvolau', 'Nuvolau', 'Nuvolau', 46.519, 12.046, 2575, 'IT', 'peak', 'dolomites', 'T2'],
  // ── Central European uplands ──
  ['brocken', 'Brocken', 'Brocken', 51.799, 10.616, 1141, 'DE', 'peak', 'central-europe', 'T1'],
  ['feldberg', 'Feldberg (Schwarzwald)', 'Feldberg', 47.874, 8.004, 1493, 'DE', 'peak', 'central-europe', 'T1'],
  ['grosser-arber', 'Großer Arber', 'Großer Arber', 49.113, 13.136, 1456, 'DE', 'peak', 'central-europe', 'T1', ['Grosser Arber']],
  ['fichtelberg', 'Fichtelberg', 'Fichtelberg', 50.429, 12.954, 1215, 'DE', 'peak', 'central-europe', 'T1'],
  ['wasserkuppe', 'Wasserkuppe', 'Wasserkuppe', 50.498, 9.938, 950, 'DE', 'peak', 'central-europe', 'T1'],
  ['grand-ballon', 'Grand Ballon', 'Grand Ballon', 47.901, 7.098, 1424, 'FR', 'peak', 'central-europe', 'T1'],
  ['snezka', 'Sněžka', 'Sněžka', 50.736, 15.740, 1603, 'CZ', 'peak', 'central-europe', 'T1', ['Snezka', 'Schneekoppe', 'Śnieżka']],
  // ── Pyrenees & Iberia ──
  ['aneto', 'Aneto', 'Aneto', 42.631, 0.657, 3404, 'ES', 'peak', 'pyrenees-iberia', 'L'],
  ['monte-perdido', 'Monte Perdido', 'Monte Perdido', 42.675, 0.034, 3355, 'ES', 'peak', 'pyrenees-iberia', 'T5', ['Mont Perdu']],
  ['vignemale', 'Vignemale (Pique Longue)', 'Pique Longue', 42.774, -0.147, 3298, 'FR', 'peak', 'pyrenees-iberia', 'L', ['Vignemale']],
  ['pic-du-midi-de-bigorre', 'Pic du Midi de Bigorre', 'Pic du Midi de Bigorre', 42.936, 0.142, 2877, 'FR', 'peak', 'pyrenees-iberia', 'T2'],
  ['canigou', 'Canigou', 'Pic du Canigou', 42.519, 2.457, 2784, 'FR', 'peak', 'pyrenees-iberia', 'T3', ['Canigó']],
  ['pica-d-estats', "Pica d'Estats", "Pica d'Estats", 42.666, 1.398, 3143, 'ES', 'peak', 'pyrenees-iberia', 'T3'],
  ['mulhacen', 'Mulhacén', 'Mulhacén', 37.053, -3.311, 3479, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Mulhacen']],
  ['penalara', 'Peñalara', 'Peñalara', 40.850, -3.956, 2428, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Penalara']],
  ['montserrat', 'Montserrat (Sant Jeroni)', 'Sant Jeroni', 41.605, 1.811, 1236, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Montserrat']],
  ['torre-de-cerredo', 'Torre de Cerredo', 'Torre de Cerredo', 43.198, -4.853, 2650, 'ES', 'peak', 'pyrenees-iberia', 'T4'],
  ['teide', 'Teide', 'Teide', 28.272, -16.642, 3715, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Pico del Teide']],
  // ── British Isles ──
  ['ben-nevis', 'Ben Nevis', 'Ben Nevis', 56.797, -5.004, 1345, 'GB', 'peak', 'british-isles', 'T2'],
  ['yr-wyddfa', 'Yr Wyddfa (Snowdon)', 'Yr Wyddfa', 53.068, -4.076, 1085, 'GB', 'peak', 'british-isles', 'T2', ['Snowdon']],
  ['scafell-pike', 'Scafell Pike', 'Scafell Pike', 54.454, -3.212, 978, 'GB', 'peak', 'british-isles', 'T3'],
  ['helvellyn', 'Helvellyn', 'Helvellyn', 54.527, -3.016, 950, 'GB', 'peak', 'british-isles', 'T3'],
  ['pen-y-fan', 'Pen y Fan', 'Pen y Fan', 51.884, -3.437, 886, 'GB', 'peak', 'british-isles', 'T1'],
  ['carrauntoohil', 'Carrauntoohil', 'Carrauntoohil', 51.999, -9.743, 1039, 'IE', 'peak', 'british-isles', 'T3'],
  // ── Scandinavia & Iceland ──
  ['galdhoepiggen', 'Galdhøpiggen', 'Galdhøpiggen', 61.636, 8.313, 2469, 'NO', 'peak', 'scandinavia', 'T3', ['Galdhopiggen']],
  ['snoehetta', 'Snøhetta', 'Snøhetta', 62.320, 9.268, 2286, 'NO', 'peak', 'scandinavia', 'T3', ['Snohetta']],
  ['besseggen', 'Besseggen (Veslfjellet)', 'Veslfjellet', 61.507, 8.725, 1743, 'NO', 'peak', 'scandinavia', 'T3', ['Besseggen']],
  ['kebnekaise', 'Kebnekaise', 'Kebnekaise', 67.900, 18.517, 2097, 'SE', 'peak', 'scandinavia', 'T3'],
  ['hvannadalshnukur', 'Hvannadalshnúkur', 'Hvannadalshnúkur', 64.014, -16.678, 2110, 'IS', 'peak', 'scandinavia', 'L', ['Hvannadalshnukur']],
  // ── Carpathians & Tatras ──
  ['gerlachovsky-stit', 'Gerlachovský štít', 'Gerlachovský štít', 49.164, 20.134, 2655, 'SK', 'peak', 'carpathians', 'WS', ['Gerlach']],
  ['rysy', 'Rysy', 'Rysy', 49.179, 20.088, 2501, 'SK', 'peak', 'carpathians', 'T4'],
  ['krivan', 'Kriváň', 'Kriváň', 49.162, 19.999, 2494, 'SK', 'peak', 'carpathians', 'T4', ['Krivan']],
  ['kasprowy-wierch', 'Kasprowy Wierch', 'Kasprowy Wierch', 49.232, 19.982, 1987, 'PL', 'peak', 'carpathians', 'T2'],
  ['giewont', 'Giewont', 'Giewont', 49.251, 19.934, 1895, 'PL', 'peak', 'carpathians', 'T3'],
  ['moldoveanu', 'Moldoveanu', 'Moldoveanu', 45.600, 24.736, 2544, 'RO', 'peak', 'carpathians', 'T3'],
  ['hoverla', 'Hoverla', 'Hoverla', 48.160, 24.500, 2061, 'UA', 'peak', 'carpathians', 'T2', ['Goverla']],
  // ── Balkans & Greece ──
  ['mytikas', 'Olympus (Mytikas)', 'Mytikas', 40.086, 22.359, 2918, 'GR', 'peak', 'balkans-greece', 'T5', ['Olympus', 'Olymp']],
  ['musala', 'Musala', 'Musala', 42.179, 23.585, 2925, 'BG', 'peak', 'balkans-greece', 'T2'],
  ['vihren', 'Vihren', 'Vihren', 41.767, 23.399, 2914, 'BG', 'peak', 'balkans-greece', 'T3'],
  ['bobotov-kuk', 'Bobotov Kuk (Durmitor)', 'Bobotov Kuk', 43.128, 19.029, 2523, 'ME', 'peak', 'balkans-greece', 'T3', ['Durmitor']],
  ['korab', 'Korab', 'Korab', 41.790, 20.546, 2764, 'MK', 'peak', 'balkans-greece', 'T3'],
  ['parnassus', 'Parnassus (Liakoura)', 'Liakoura', 38.537, 22.623, 2457, 'GR', 'peak', 'balkans-greece', 'T2', ['Parnassus', 'Parnassos']],
  // ── Apennines & Mediterranean ──
  ['etna', 'Etna', 'Etna', 37.751, 14.994, 3357, 'IT', 'peak', 'mediterranean', 'T3'],
  ['vesuvius', 'Vesuvius', 'Vesuvio', 40.821, 14.426, 1281, 'IT', 'peak', 'mediterranean', 'T1', ['Vesuvio', 'Vesuv']],
  ['corno-grande', 'Gran Sasso (Corno Grande)', 'Corno Grande', 42.469, 13.566, 2912, 'IT', 'peak', 'mediterranean', 'T4', ['Gran Sasso']],
  ['stromboli', 'Stromboli', 'Stromboli', 38.794, 15.213, 924, 'IT', 'peak', 'mediterranean', 'T2'],
  ['monte-cinto', 'Monte Cinto', 'Monte Cinto', 42.379, 8.946, 2706, 'FR', 'peak', 'mediterranean', 'T4'],
  ['psiloritis', 'Psiloritis (Mount Ida)', 'Psiloritis', 35.227, 24.769, 2456, 'GR', 'peak', 'mediterranean', 'T2', ['Mount Ida', 'Ida']],
  // ── Africa ──
  ['kilimanjaro', 'Kilimanjaro (Uhuru Peak)', 'Uhuru Peak', -3.076, 37.353, 5895, 'TZ', 'peak', 'africa', 'T3', ['Kilimanjaro', 'Kibo']],
  ['mount-meru', 'Mount Meru', 'Mount Meru', -3.247, 36.748, 4562, 'TZ', 'peak', 'africa', 'T3'],
  ['point-lenana', 'Mount Kenya (Point Lenana)', 'Point Lenana', -0.152, 37.318, 4985, 'KE', 'peak', 'africa', 'T3', ['Mount Kenya']],
  ['toubkal', 'Toubkal', 'Toubkal', 31.060, -7.916, 4167, 'MA', 'peak', 'africa', 'T3', ['Jbel Toubkal']],
  ['table-mountain', "Table Mountain (Maclear's Beacon)", "Maclear's Beacon", -33.963, 18.425, 1086, 'ZA', 'peak', 'africa', 'T2', ['Table Mountain']],
  // ── North America ──
  ['denali', 'Denali', 'Denali', 63.069, -151.007, 6190, 'US', 'peak', 'north-america', 'WS', ['Mount McKinley']],
  ['mount-whitney', 'Mount Whitney', 'Mount Whitney', 36.579, -118.292, 4421, 'US', 'peak', 'north-america', 'T3'],
  ['mount-rainier', 'Mount Rainier', 'Mount Rainier', 46.853, -121.760, 4392, 'US', 'peak', 'north-america', 'WS'],
  ['mount-elbert', 'Mount Elbert', 'Mount Elbert', 39.118, -106.445, 4401, 'US', 'peak', 'north-america', 'T2'],
  ['longs-peak', 'Longs Peak', 'Longs Peak', 40.255, -105.616, 4346, 'US', 'peak', 'north-america', 'T5'],
  ['pikes-peak', 'Pikes Peak', 'Pikes Peak', 38.841, -105.044, 4302, 'US', 'peak', 'north-america', 'T2'],
  ['half-dome', 'Half Dome', 'Half Dome', 37.746, -119.533, 2695, 'US', 'peak', 'north-america', 'T4'],
  ['mount-st-helens', 'Mount St. Helens', 'Mount Saint Helens', 46.191, -122.196, 2549, 'US', 'peak', 'north-america', 'T3', ['Mount St Helens']],
  ['mount-washington', 'Mount Washington', 'Mount Washington', 44.271, -71.303, 1917, 'US', 'peak', 'north-america', 'T3'],
  ['mount-temple', 'Mount Temple', 'Mount Temple', 51.351, -116.206, 3543, 'CA', 'peak', 'north-america', 'T5'],
  ['pico-de-orizaba', 'Pico de Orizaba', 'Pico de Orizaba', 19.030, -97.269, 5636, 'MX', 'peak', 'north-america', 'L', ['Citlaltépetl']],
  // ── South America ──
  ['aconcagua', 'Aconcagua', 'Aconcagua', -32.653, -70.011, 6961, 'AR', 'peak', 'south-america', 'T4'],
  ['chimborazo', 'Chimborazo', 'Chimborazo', -1.469, -78.817, 6263, 'EC', 'peak', 'south-america', 'WS'],
  ['cotopaxi', 'Cotopaxi', 'Cotopaxi', -0.681, -78.438, 5897, 'EC', 'peak', 'south-america', 'L'],
  ['huayna-potosi', 'Huayna Potosí', 'Huayna Potosí', -16.262, -68.154, 6088, 'BO', 'peak', 'south-america', 'WS', ['Huayna Potosi']],
  ['villarrica', 'Villarrica', 'Volcán Villarrica', -39.421, -71.939, 2847, 'CL', 'peak', 'south-america', 'L'],
  // ── Asia & Caucasus ──
  ['everest', 'Mount Everest', 'Mount Everest', 27.988, 86.925, 8849, 'NP', 'peak', 'asia', 'ZS', ['Everest', 'Sagarmatha', 'Chomolungma']],
  ['kala-patthar', 'Kala Patthar', 'Kala Patthar', 27.996, 86.829, 5644, 'NP', 'peak', 'asia', 'T3'],
  ['gokyo-ri', 'Gokyo Ri', 'Gokyo Ri', 27.962, 86.684, 5357, 'NP', 'peak', 'asia', 'T3'],
  ['island-peak', 'Island Peak (Imja Tse)', 'Imja Tse', 27.922, 86.936, 6189, 'NP', 'peak', 'asia', 'WS', ['Island Peak']],
  ['fuji', 'Mount Fuji', 'Mount Fuji', 35.361, 138.727, 3776, 'JP', 'peak', 'asia', 'T3', ['Fuji', 'Fujisan']],
  ['kinabalu', 'Mount Kinabalu', 'Mount Kinabalu', 6.075, 116.558, 4095, 'MY', 'peak', 'asia', 'T3', ['Kinabalu']],
  ['rinjani', 'Mount Rinjani', 'Rinjani', -8.411, 116.457, 3726, 'ID', 'peak', 'asia', 'T3', ['Gunung Rinjani']],
  ['elbrus', 'Elbrus', 'Elbrus', 43.355, 42.439, 5642, 'RU', 'peak', 'asia', 'L'],
  ['ararat', 'Mount Ararat', 'Ağrı Dağı', 39.702, 44.298, 5137, 'TR', 'peak', 'asia', 'L', ['Ararat', 'Agri Dagi']],
  // ── Oceania & Pacific ──
  ['aoraki', 'Aoraki / Mount Cook', 'Aoraki / Mount Cook', -43.595, 170.142, 3724, 'NZ', 'peak', 'oceania', 'ZS', ['Mount Cook', 'Aoraki']],
  ['ngauruhoe', 'Mount Ngauruhoe', 'Mount Ngauruhoe', -39.157, 175.632, 2291, 'NZ', 'peak', 'oceania', 'T4'],
  ['taranaki', 'Mount Taranaki', 'Taranaki Maunga', -39.296, 174.063, 2518, 'NZ', 'peak', 'oceania', 'T4', ['Mount Egmont', 'Taranaki']],
  ['roys-peak', 'Roys Peak', 'Roys Peak', -44.694, 169.049, 1578, 'NZ', 'peak', 'oceania', 'T2'],
  ['kosciuszko', 'Mount Kosciuszko', 'Mount Kosciuszko', -36.456, 148.263, 2228, 'AU', 'peak', 'oceania', 'T1', ['Kosciuszko']],
  ['mauna-kea', 'Mauna Kea', 'Mauna Kea', 19.821, -155.468, 4207, 'US', 'peak', 'oceania', 'T2'],
]

const r5 = v => Math.round(v * 1e5) / 1e5
const sleep = ms => new Promise(r => setTimeout(r, ms))
// volcanoes are natural=volcano in OSM, not natural=peak
const TAGS = { peak: 'osm_tag=natural:peak&osm_tag=natural:volcano', hut: 'osm_tag=tourism:alpine_hut' }

const toEntry = ([id, name, , lat, lon, elev, country, kind, region, grade, aka]) =>
  ({ id, name, ...(aka ? { aka } : {}), lat, lon, elev, country, kind, region, grade })

// 1. every row valid before asking anyone anything
const seen = new Set()
const bad = LIST.map(row => checkPeak(toEntry(row), seen)).filter(Boolean)
if (bad.length) { console.error(bad.join('\n')); process.exit(1) }

// 2. exact coordinates: the OpenStreetMap match nearest the hint, within 3 km
async function resolve(row) {
  const [id, , query, lat, lon, , , kind] = row
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&${TAGS[kind]}&limit=10&lat=${lat}&lon=${lon}`, { headers: UA })
  const features = res.ok ? (await res.json()).features ?? [] : []
  const best = features
    .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    .map(p => ({ ...p, km: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)[0]
  if (!best || best.km > 3) return { id, missing: best ? `nearest match ${best.km.toFixed(1)} km away` : 'no match' }
  return { ...toEntry(row), lat: r5(best.lat), lon: r5(best.lon) }
}

const out = [], missing = []
for (const row of LIST) {
  const r = await resolve(row)
  if (r.missing) missing.push(`${r.id}: ${r.missing}`)
  else out.push(r)
  await sleep(300) // be fair to the public Photon instance
}
if (missing.length) {
  console.error(`No OpenStreetMap summit within 3 km — fix the hint or the search text:\n${missing.join('\n')}`)
  process.exit(1)
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} featured peaks → ${path.relative(process.cwd(), OUT)}`)
