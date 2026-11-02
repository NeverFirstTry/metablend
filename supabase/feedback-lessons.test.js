import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// supabase/feedback-lessons.sql in a real Postgres (PGlite), as it runs on Supabase.
const sql = fs.readFileSync(new URL('./feedback-lessons.sql', import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice

const HALF_HOUR = 30 * 60 * 1000
const claim = async (city, ms = HALF_HOUR) => (await db.query('select public.claim_feedback_lesson($1, $2) as ok', [city, ms])).rows[0].ok

test('claim_feedback_lesson — the first report in a window gets the lesson, the rest of the burst does not', async () => {
  assert.equal(await claim('Wien'), true)
  assert.equal(await claim('Wien'), false)
  assert.equal(await claim('Wien'), false)
  assert.equal(await claim('Graz'), true) // each city has its own window
})

test('claim_feedback_lesson — once the window has passed, the next report learns again', async () => {
  assert.equal(await claim('Linz'), true)
  await db.exec(`update public.feedback_lessons set learned_at = now() - interval '31 minutes' where city = 'Linz'`)
  assert.equal(await claim('Linz'), true)
  assert.equal(await claim('Linz'), false)
  await db.exec(`update public.feedback_lessons set learned_at = now() - interval '10 minutes' where city = 'Linz'`)
  assert.equal(await claim('Linz', 5 * 60 * 1000), true) // the app sets the window, no new SQL
})

test('feedback_lessons — only the API (service role) touches it', async () => {
  for (const role of ['anon', 'authenticated']) {
    const { rows } = await db.query(`select has_table_privilege('${role}', 'public.feedback_lessons', 'select') as t, has_function_privilege('${role}', 'public.claim_feedback_lesson(text, integer)', 'execute') as f`)
    assert.deepEqual(rows[0], { t: false, f: false }, role)
  }
  assert.equal((await db.query(`select has_function_privilege('service_role', 'public.claim_feedback_lesson(text, integer)', 'execute') as f`)).rows[0].f, true)
})
