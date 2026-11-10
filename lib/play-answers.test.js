// Play's production access form takes at most 300 characters per text answer (docs/play-production-access.md):
// each answer is one "> " line, followed by its stated count.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const doc = fs.readFileSync(new URL('../docs/play-production-access.md', import.meta.url), 'utf8')
const answers = [...doc.matchAll(/^> (.*)$/gm)].map(m => m[1])
const counts = [...doc.matchAll(/^Characters: (\d+) \/ 300$/gm)].map(m => Number(m[1]))

test('the seven text answers are each at most 300 characters, and the stated counts are right', () => {
  assert.equal(answers.length, 7, 'one "> " line per text field')
  assert.equal(counts.length, answers.length, 'a "Characters: N / 300" line after every answer')
  answers.forEach((text, i) => {
    assert.ok(text.length <= 300, `${text.length} characters: "${text.slice(0, 50)}…"`)
    assert.equal(text.length, counts[i], `the count says ${counts[i]}, the answer has ${text.length}: "${text.slice(0, 50)}…"`)
  })
})

// the project's wording rules (lib/wording.test.js) for the form too: commas and full stops, no safety or reliability claims
test('the answers use no em or en dash and claim nothing safe or reliable', () => {
  for (const text of answers) {
    assert.doesNotMatch(text, /[–—]/, `em or en dash in "${text.slice(0, 50)}…"`)
    assert.doesNotMatch(text, /\b(safe|reliab)/i, `safe or reliable in "${text.slice(0, 50)}…"`)
  }
})
