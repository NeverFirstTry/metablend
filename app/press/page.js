import fs from 'node:fs'
import path from 'node:path'
import { PRESS_KIT } from '@/lib/press'
import PressContent from './PressContent'

export const metadata = {
  title: 'Press',
  description: 'MetaBlend for the press: what it is, key facts, the press contact, and the press kit with logo, app icon and screenshots.',
  alternates: { canonical: '/press' },
}

// Metadata and the press kit's size on the server (read at build); the English or German body is client-side
// (it reads the language cookie), like /support. Static: no render per visit.
export default function Press() {
  const kitBytes = fs.statSync(path.join(process.cwd(), 'public', PRESS_KIT)).size
  return <PressContent kitBytes={kitBytes} />
}
