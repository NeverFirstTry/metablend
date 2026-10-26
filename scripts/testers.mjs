// The Android tester list from /testers, for the owner (calls /api/testers/export
// with CALIBRATE_SECRET from .env.local — the key is sent in a header, never printed):
//
//   node scripts/testers.mjs export        everyone still in the test → Downloads/metablend-testers.csv
//                                          Upload it in Play Console (Closed testing → Testers) to an
//                                          email list kept ONLY for these sign-ups: an upload REPLACES
//                                          that whole list.
//   node scripts/testers.mjs mark-added    after the upload: exactly the new ones in that file → added,
//                                          and their addresses for the Bcc of the opt-in mail
//   node scripts/testers.mjs new           who is waiting (read-only)
//   node scripts/testers.mjs status opted_in a@gmail.com [b@gmail.com …]    (new | added | opted_in | removed)
//   node scripts/testers.mjs delete a@gmail.com [b@gmail.com …]            (on request)
//   node scripts/testers.mjs delete-all "delete all testers"               (when the test ends)
//
// TESTERS_BASE=http://localhost:3123 for a local `next start`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { testersCsv } from '../lib/testers-signup.js'

const env = existsSync('.env.local')
  ? Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
  : {}
const KEY = process.env.CALIBRATE_SECRET || env.CALIBRATE_SECRET
const BASE = process.env.TESTERS_BASE ?? 'https://metablend.app'
const URL_ = `${BASE}/api/testers/export`
const LAST = join(tmpdir(), 'metablend-testers-last-export.json') // the new addresses in the last exported file
const [cmd, ...args] = process.argv.slice(2)
const REUPLOAD = 'They stay on the Play list until you run "export" again and upload the new file.'

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
  return res.json()
}
const post = body => call('POST', { body })
const chunks = (list, n = 500) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

if (cmd === 'export') {
  const { testers } = await call('GET', { query: '?format=json' })
  if (!testers.length && args[0] !== '--force') {
    console.error('Nobody on the list — not writing an empty file (uploading it would empty the Play list). Use --force to write it anyway.')
    process.exit(1)
  }
  const fresh = testers.filter(t => t.status === 'new').map(t => t.email)
  const dir = existsSync(join(homedir(), 'Downloads')) ? join(homedir(), 'Downloads') : '.'
  const file = join(dir, 'metablend-testers.csv')
  writeFileSync(file, testersCsv(testers))
  writeFileSync(LAST, JSON.stringify({ at: new Date().toISOString(), emails: fresh }))
  console.log(`${testers.length} testers (${fresh.length} new) → ${file}`)
  console.log('Upload it to the email list you keep only for these sign-ups (an upload replaces that list),')
  console.log('then: node scripts/testers.mjs mark-added')
} else if (cmd === 'mark-added') {
  if (!existsSync(LAST)) { console.error('Run "export" first.'); process.exit(1) }
  const { at, emails } = JSON.parse(readFileSync(LAST, 'utf8'))
  if (!emails.length) { console.log(`No new addresses in the export from ${at}.`); process.exit(0) }
  let changed = []
  for (const part of chunks(emails)) changed = changed.concat((await post({ action: 'set-status', status: 'added', emails: part })).emails)
  console.log(`${changed.length} marked added (from the export of ${at}).`)
  console.log('Send them the opt-in link (Bcc):')
  console.log(changed.join(', '))
} else if (cmd === 'new') {
  const { testers } = await call('GET', { query: '?format=json&only=new' })
  console.log(testers.length ? testers.map(t => t.email).join(', ') : '(no new sign-ups)')
} else if (cmd === 'status') {
  console.log(JSON.stringify(await post({ action: 'set-status', status: args[0], emails: args.slice(1) }), null, 2))
  if (args[0] === 'removed') console.log(REUPLOAD)
} else if (cmd === 'delete') {
  console.log(JSON.stringify(await post({ action: 'delete', emails: args }), null, 2))
  console.log(REUPLOAD)
} else if (cmd === 'delete-all') {
  console.log(JSON.stringify(await post({ action: 'delete-all', confirm: args[0] }), null, 2))
  console.log('Also remove the email list in Play Console (or upload an empty file to it).')
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'))
}
