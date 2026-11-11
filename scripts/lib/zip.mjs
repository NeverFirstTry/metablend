// A ZIP archive from in-memory files (the press kit, scripts/brand/press-kit.mjs): deflated entries, CRC-32 and
// deflate from node:zlib, UTF-8 names. shortcut: no ZIP64, so under 4 GB and 65535 entries; enough for a press kit.
import { crc32, deflateRawSync } from 'node:zlib'

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
