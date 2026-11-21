// A removal that waits: the item goes for good after `ms` unless Undo comes first (My routes, UX review
// 2026-11-20, G1: the bin removed an imported track at once, the one thing in the app the user brought).
// One at a time: starting a second removal, or commit() when the screen is left, makes the waiting one final.
export function pendingRemoval(remove, ms = 6000, timers = globalThis) {
  let id = null, timer = null
  const commit = () => {
    timers.clearTimeout(timer)
    if (id == null) return Promise.resolve()
    const x = id
    id = null
    return remove(x)
  }
  return {
    start(next) { const before = commit(); id = next; timer = timers.setTimeout(commit, ms); return before },
    undo() { timers.clearTimeout(timer); const x = id; id = null; return x },
    commit,
  }
}
