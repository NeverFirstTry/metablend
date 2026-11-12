// A ZIP archive from in-memory files (the press kit, scripts/brand/press-kit.mjs): deflated entries, CRC-32 and
// deflate from node:zlib, UTF-8 names. shortcut: no ZIP64, so under 4 GB and 65535 entries; enough for a press kit.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'

// Read an archive back through its central directory, as an unzip tool does (the press kit keeps shots
// from its last build this way). Stored and deflated entries; a CRC that does not match throws.
export function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('not a ZIP: no end of central directory')
  const out = []
  for (let i = 0, at = buf.readUInt32LE(end + 16); i < buf.readUInt16LE(end + 10); i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`entry ${i}: no central directory header`)
    const method = buf.readUInt16LE(at + 10), crc = buf.readUInt32LE(at + 16), packed = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28), local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + packed)
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw)
    if (crc32(data) !== crc) throw new Error(`${name}: CRC does not match`)
    out.push({ name, data })
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
  }
  return out
}

export function zip(entries, date = new Date()) {
  // DOS time and date, as ZIP stores them
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const locals = [], central = []
  let offset = 0
  for (const { name, data } of entries) {
    const file = Buffer.from(name, 'utf8'), packed = deflateRawSync(data, { level: 9 }), crc = crc32(data)
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8)
    head.writeUInt16LE(time, 10); head.writeUInt16LE(day, 12); head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(file.length, 26)
    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10)
    dir.writeUInt16LE(time, 12); dir.writeUInt16LE(day, 14); dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(file.length, 28); dir.writeUInt32LE(offset, 42)
    locals.push(head, file, packed)
    central.push(dir, file)
    offset += head.length + file.length + packed.length
  }
  const size = central.reduce((s, b) => s + b.length, 0), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...central, end])
}
