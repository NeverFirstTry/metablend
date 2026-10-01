// Private keys pasted into Vercel come back in every shape: real line breaks,
// spaces where the breaks were, literal "\n" copied from a JSON file (or
// doubled "\\n"), Windows line endings, surrounding quotes. OpenSSL only
// reads the proper layout, so rebuild it from the base64 between the markers.
import { createPrivateKey } from 'node:crypto'

export function normalizePem(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\\+[nr]/g, '\n') // literal \n / \\n / \r → a break
  const m = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/)
  if (!m) return null
  const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '')
  if (!body) return null
  return `-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END ${m[1]}-----\n`
}

export function readableKey(pem) {
  if (!pem) return false
  try { createPrivateKey(pem); return true } catch { return false }
}
