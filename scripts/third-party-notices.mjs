// Writes THIRD_PARTY_NOTICES.md: the software and fonts MetaBlend ships (in the website's bundles and
// in the apps), each with its licence text. Their licences ask that the notice travels with copies.
//   node scripts/third-party-notices.mjs          (after a dependency changed; needs node_modules)
// The packages come from `npm ls --omit=dev --all` (what is installed for production) and each
// package's own licence file. What npm cannot see is listed by hand below: Leaflet (our own copy in
// public/vendor), the two fonts (next/font serves them from our domain), and the apps' native libraries.
// Data sources are not software: their credits are in the README and on metablend.app/terms.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n').trim()

// ── what npm installed for production ──
let tree
try { tree = JSON.parse(execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], { cwd: ROOT, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64e6 })) } catch (e) { tree = JSON.parse(e.stdout || '{}') }
const seen = new Map()
const walk = deps => { for (const [name, d] of Object.entries(deps ?? {})) if (!seen.has(name)) { seen.set(name, d.version); walk(d.dependencies) } }
walk(tree.dependencies)
const packages = []
for (const [name, version] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) {
  const base = join(ROOT, 'node_modules', name)
  if (!existsSync(join(base, 'package.json'))) continue // an optional peer that is not installed is not shipped
  const pkg = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'))
  const file = readdirSync(base).find(f => /^licen[sc]e(\.(md|txt))?$/i.test(f))
  const licence = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'see its text'
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name ?? ''
  packages.push({ name, version: pkg.version ?? version, licence, where: 'website and apps', text: file ? readFileSync(join(base, file), 'utf8').replace(/\r\n/g, '\n').trim() : `${licence} (the package ships no licence file${author ? `; author: ${author}` : ''}; see https://www.npmjs.com/package/${name})` })
}
if (packages.length < 10) throw new Error('npm ls gave too few packages: is node_modules installed?')

// ── what npm cannot see ──
const capacitor = packages.find(p => p.name === '@capacitor/core')
const apache = read('scripts/third-party/Apache-2.0.txt')
const fixed = [
  { name: 'Leaflet', version: '1.9.4', licence: 'BSD-2-Clause', where: 'website and apps (maps), public/vendor/leaflet-1.9.4', text: read('public/vendor/leaflet-1.9.4/LICENSE') },
  { name: 'Hanken Grotesk (font)', version: 'as served by next/font', licence: 'OFL-1.1', where: 'website and apps (text)', text: read('scripts/third-party/OFL-Hanken-Grotesk.txt') },
  { name: 'Geist Mono (font)', version: 'as served by next/font', licence: 'OFL-1.1', where: 'website and apps (figures)', text: read('scripts/third-party/OFL-Geist-Mono.txt') },
  // the native runtimes come from the same project and licence as @capacitor/core (mobile/package.json)
  { name: '@capacitor/android', version: `as @capacitor/core ${capacitor.version}`, licence: capacitor.licence, where: 'Android app', text: capacitor.text },
  { name: '@capacitor/ios', version: `as @capacitor/core ${capacitor.version}`, licence: capacitor.licence, where: 'iPhone app', text: capacitor.text },
  { name: 'AndroidX AppCompat, CoordinatorLayout, Core SplashScreen', version: 'see mobile/android/variables.gradle', licence: 'Apache-2.0', where: 'Android app', text: apache },
  { name: 'Firebase Cloud Messaging (through the push notifications plugin)', version: 'see the plugin', licence: 'Apache-2.0', where: 'Android app', text: apache },
  { name: 'Apache Cordova Android (plugin bridge)', version: 'see @capacitor/android', licence: 'Apache-2.0', where: 'Android app', text: apache },
]
const all = [...fixed.slice(0, 3), ...packages, ...fixed.slice(3)]

// ── the file: one table, then each distinct licence text once with the components it covers ──
const texts = new Map()
for (const c of all) texts.set(c.text, [...(texts.get(c.text) ?? []), c])
const cell = s => String(s).replaceAll('|', '\\|')
const out = [
  '# Third-party notices',
  '',
  'MetaBlend ships the software and fonts below, in the website\'s pages and in the Android and iPhone apps. Each stays under its own licence; the texts follow the table. MetaBlend\'s own code is under the licence in [LICENSE](LICENSE).',
  '',
  'Weather and map data are not software and are not listed here: their providers and licences are credited in the [README](README.md#data-sources-and-credits) and on [metablend.app/terms](https://metablend.app/terms). The data files kept in this repository (airports, avalanche and warning regions) remain under their providers\' terms as well.',
  '',
  'Written by `node scripts/third-party-notices.mjs` from what is installed for production; run it again after a dependency changes. Not listed: libraries the Android and iPhone build tools add on their own beyond the ones named here.',
  '',
  '## Components',
  '',
  '| Component | Version | Licence | Shipped in |',
  '|---|---|---|---|',
  ...all.map(c => `| ${cell(c.name)} | ${cell(c.version)} | ${cell(c.licence)} | ${cell(c.where)} |`),
  '',
  '## Licence texts',
  '',
  ...[...texts].flatMap(([text, list]) => [
    `### ${[...new Set(list.map(c => c.licence))].join(', ')}: ${list.map(c => c.name).join(', ')}`,
    '',
    '```text',
    text.replaceAll('```', "'''"),
    '```',
    '',
  ]),
]
writeFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), out.join('\n'))
console.log(`THIRD_PARTY_NOTICES.md: ${all.length} components, ${texts.size} licence texts, ${Math.round(out.join('\n').length / 1024)} KB`)
