// A headless browser for the capture scripts on a debugging port it picks itself: with a fixed port, two
// sessions running a script at once ended up driving one browser (2026-11-10). The port is read back from
// DevToolsActivePort in the browser's own profile, so a script only ever talks to the browser it started.
// The same start and end as scripts/check-phone-layout.mjs.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = ms => new Promise(r => setTimeout(r, ms))
// Up to 5 s: Windows frees a killed browser's files a moment after it ends, and rmSync's own maxRetries did
// nothing here (Node 26: EPERM after 4 ms, no retry). Synchronous, so it also works while the process exits.
const remove = profile => {
  for (let i = 0; i < 25; i++) {
    try { rmSync(profile, { recursive: true, force: true }); return } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200) }
  }
}

export async function launchBrowser(exe, prefix, args = []) {
  const profile = mkdtempSync(join(tmpdir(), prefix))
  const browser = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, ...args, 'about:blank'], { stdio: 'ignore' })
  const gone = new Promise(r => browser.once('exit', r))
  // However the script ends (an error, an exit on the way, Ctrl+C), the profile (about 400 MB) goes with it:
  // the browser's whole process tree first, since a helper still running keeps its files locked
  process.once('exit', () => {
    if (!existsSync(profile)) return
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
    else browser.kill('SIGKILL')
    remove(profile)
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit(130))
  // the normal end: closed over DevTools, the browser ends its helpers and frees the profile, which then goes
  const close = async active => {
    try {
      const ws = new WebSocket(active)
      await Promise.race([new Promise((r, j) => { ws.onopen = r; ws.onerror = j }), sleep(3000)])
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
    } catch { /* already gone */ }
    await Promise.race([gone, sleep(5000)])
    browser.kill()
    remove(profile)
  }
  for (let i = 0; i < 120; i++) { // up to 30 s
    await sleep(250)
    let port, path
    try { [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n').map(s => s.trim()) } catch { continue } // not written yet
    const targets = port && path && await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null)
    // active: the browser-level DevTools address (browser contexts, new targets)
    const active = `ws://127.0.0.1:${port}${path}`
    if (targets) return { browser, targets, active, close: () => close(active) }
  }
  await close(null)
  throw new Error('The browser did not open its debugging port within 30 seconds')
}
