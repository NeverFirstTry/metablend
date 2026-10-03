// Records one real Open-Meteo 15-minute response (Vienna: three fine models)
// for lib/nowcast.test.js:  node scripts/record-nowcast-fixture.mjs
import fs from 'node:fs'
import { nowcastUrl } from '../lib/nowcast.js'

const res = await fetch(nowcastUrl({ lat: 48.21, lon: 16.37 }))
if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
fs.writeFileSync(new URL('../lib/__fixtures__/nowcast-vienna.json', import.meta.url), JSON.stringify(await res.json(), null, 1) + '\n')
console.log('recorded lib/__fixtures__/nowcast-vienna.json')
