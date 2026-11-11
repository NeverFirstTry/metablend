import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crc32, inflateRawSync } from 'node:zlib'
import { zip } from './zip.mjs'

// read an archive back through its central directory, as an unzip tool does
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const out = []
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50)
    const crc = buf.readUInt32LE(at + 16), packed = buf.readUInt32LE(at + 20), nameLen = buf.readUInt16LE(at + 28), local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = inflateRawSync(buf.subarray(start, start + packed))
    assert.equal(crc32(data), crc, `${name}: CRC`)
    out.push({ name, data })
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
  }
  return out
}

test('zip — every entry comes back byte for byte, with its UTF-8 name and CRC', () => {
  const files = [
    { name: 'MetaBlend press kit/README.txt', data: Buffer.from('Größe, 雪崩, 눈사태\n'.repeat(50)) },
    { name: 'MetaBlend press kit/logo/mark.svg', data: Buffer.from('<svg/>') },
    { name: 'MetaBlend press kit/empty.txt', data: Buffer.alloc(0) },
    { name: 'MetaBlend press kit/random.bin', data: Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7919) % 256)) },
  ]
  const back = unzip(zip(files, new Date(2026, 11, 8, 9, 30, 0)))
  assert.deepEqual(back.map(f => f.name), files.map(f => f.name))
  back.forEach((f, i) => assert.ok(f.data.equals(files[i].data), f.name))
})
