// The Android tester list from /testers, for the owner (calls /api/testers/export
// with CALIBRATE_SECRET from .env.local — the key is sent in a header, never printed):
//
//   node scripts/testers.mjs export        everyone still in the test → Downloads/metablend-testers.csv
//                                          (Play Console: Closed testing → Testers → your email list →
//                                          upload CSV; an upload REPLACES the list, so it's everyone)
//   node scripts/testers.mjs new           just the new addresses, comma-separated (Bcc for the opt-in
//                                          mail, or Play's "add email addresses" box)
//   node scripts/testers.mjs mark-added    after uploading: the new ones from that export → added
//   node scripts/testers.mjs status opted_in a@gmail.com [b@gmail.com …]    (new | added | opted_in | removed)
//   node scripts/testers.mjs delete a@gmail.com [b@gmail.com …]            (on request)
//   node scripts/testers.mjs delete-all "delete all testers"               (when the test ends)
//
// TESTERS_BASE=http://localhost:3123 for a local `next start`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const env = existsSync('.env.local')
  ? Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
  : {}
const KEY = process.env.CALIBRATE_SECRET || env.CALIBRATE_SECRET
const BASE = process.env.TESTERS_BASE ?? 'https://metablend.app'
const URL_ = `${BASE}/api/testers/export`
const STAMP = join(tmpdir(), 'metablend-testers-export.txt') // the last export's time, for mark-added
const [cmd, ...args] = process.argv.slice(2)

if (!KEY) { console.error('No CALIBRATE_SECRET in .env.local or the environment.'); process.exit(1) }

async function call(method, { query = '', body } = {}) {
  const res = await fetch(URL_ + query, {
    method,
    headers: { 'x-calibrate-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    console.error(`${method} ${URL_}${query} → ${res.status}`, (await res.text()).slice(0, 300))
    process.exit(1)
  }
  return res
}
const post = async body => console.log(JSON.stringify(await (await call('POST', { body })).json(), null, 2))

if (cmd === 'export' || cmd === 'new') {
  const res = await call('GET', { query: cmd === 'new' ? '?only=new' : '' })
  const text = await res.text()
  writeFileSync(STAMP, res.headers.get('x-exported-at'))
  if (cmd === 'new') {
    console.log(text || '(no new sign-ups)')
  } else {
    const dir = existsSync(join(homedir(), 'Downloads')) ? join(homedir(), 'Downloads') : '.'
    const file = join(dir, 'metablend-testers.csv')
    writeFileSync(file, text)
    console.log(`${res.headers.get('x-count')} testers (${res.headers.get('x-new')} new) → ${file}`)
  }
  console.log('After adding them in Play Console: node scripts/testers.mjs mark-added')
} else if (cmd === 'mark-added') {
  if (!existsSync(STAMP)) { console.error('Run "export" or "new" first.'); process.exit(1) }
  await post({ action: 'mark-added', upTo: readFileSync(STAMP, 'utf8').trim() })
} else if (cmd === 'status') {
  await post({ action: 'set-status', status: args[0], emails: args.slice(1) })
} else if (cmd === 'delete') {
  await post({ action: 'delete', emails: args })
} else if (cmd === 'delete-all') {
  await post({ action: 'delete-all', confirm: args[0] })
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'))
}
