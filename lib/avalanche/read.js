// Reads /api/avalanche for a summit page: the answer, or null when it failed, was refused or took longer
// than `ms` (a slow avalanche source must not hold up the page). The browser reads it when the page opens;
// the server only to count the rated days. No AbortSignal: on the server it would change how Next keeps
// the request, so the time limit is a race and a late answer is dropped.
export function readAvalanche(url, { ms, get = fetch, init } = {}) {
  let timer
  const late = new Promise(resolve => { timer = setTimeout(() => resolve(null), ms) })
  const read = Promise.resolve()
    .then(() => get(url, init))
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
  return Promise.race([read, late]).finally(() => clearTimeout(timer))
}
