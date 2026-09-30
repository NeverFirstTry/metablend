// Compact JWTs signed with node:crypto — no SDK. RS256 for Google's service
// account, ES256 (raw r||s, as JOSE wants it) for Apple's push key.
import { createSign } from 'node:crypto'

export const b64url = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

export function signJwt(alg, header, payload, pem) {
  const data = `${b64url(header)}.${b64url(payload)}`
  const signer = createSign('SHA256').update(data)
  const sig = alg === 'ES256' ? signer.sign({ key: pem, dsaEncoding: 'ieee-p1363' }) : signer.sign(pem)
  return `${data}.${sig.toString('base64url')}`
}
