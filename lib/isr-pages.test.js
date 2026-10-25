import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A page under a dynamic [segment] is rendered on every request unless it
// exports generateStaticParams — `revalidate` alone is ignored there. Every
// such page that means to be cached (it sets revalidate) must have both, or
// each visit and every crawler hit costs a full server render.
const APP = fileURLToPath(new URL('../app/', import.meta.url))

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? pages(p) : e.name === 'page.js' ? [p] : []
  })
}

test('cached dynamic pages: revalidate under a [segment] comes with generateStaticParams', () => {
  const found = pages(APP).filter(p => /\[[^\]]+\]/.test(p))
  const cached = found.filter(p => /export const revalidate\s*=/.test(fs.readFileSync(p, 'utf8')))
  assert.ok(cached.length >= 3, `found ${cached.length}`)
  for (const p of cached) {
    assert.ok(/export (async )?function generateStaticParams/.test(fs.readFileSync(p, 'utf8')), `${path.relative(process.cwd(), p)} has no generateStaticParams`)
  }
})
