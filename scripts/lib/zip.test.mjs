import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zip, unzip } from './zip.mjs'

const files = [
  { name: 'MetaBlend press kit/README.txt', data: Buffer.from('Größe, 雪崩, 눈사태\n'.repeat(50)) },
  { name: 'MetaBlend press kit/logo/mark.svg', data: Buffer.from('<svg/>') },
  { name: 'MetaBlend press kit/empty.txt', data: Buffer.alloc(0) },
  { name: 'MetaBlend press kit/random.bin', data: Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7919) % 256)) },
]

test('zip — every entry comes back byte for byte, with its UTF-8 name and CRC', () => {
  const back = unzip(zip(files, new Date(2026, 11, 8, 9, 30, 0)))
  assert.deepEqual(back.map(f => f.name), files.map(f => f.name))
  back.forEach((f, i) => assert.ok(f.data.equals(files[i].data), f.name))
})

test('unzip — a damaged archive throws instead of handing back wrong bytes', () => {
  const archive = zip(files)
  const damaged = Buffer.from(archive)
  damaged[30 + files[0].name.length + 10] ^= 0xff // inside the first entry's packed data, past its 30-byte header and name
  assert.throws(() => unzip(damaged))
  assert.throws(() => unzip(Buffer.from('not a zip')), /not a ZIP/)
})
