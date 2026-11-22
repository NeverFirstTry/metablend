// A phone the server no longer knows (a 404 on a push address: its record went when Apple or Google said its token
// was gone, after the 90 days unseen, or the app lost its device key) registers again and the request is sent once
// more. Pure: the call and the registration come in (lib/push-client.js pushApiRegistered wires the real ones,
// and registers only a phone still opted in). A failed or refused registration leaves the 404.
export async function knownOrRegister(call, reregister) {
  const r = await call()
  if (r.status !== 404) return r
  if (!(await reregister().catch(() => false))) return r
  return call()
}
