// A headless browser for the capture scripts on a debugging port it picks itself: with a fixed port, two
// sessions running a script at once ended up driving one browser (2026-11-10). The port is read back from
// DevToolsActivePort in the browser's own profile, so a script only ever talks to the browser it started.
// The same start and end as scripts/check-phone-layout.mjs.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function launchBrowser(exe, prefix, args = []) {
  const profile = mkdtempSync(join(tmpdir(), prefix))
  const browser = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, ...args, 'about:blank'], { stdio: 'ignore' })
  const gone = new Promise(r => browser.once('exit', r))
  // Closed over DevTools, the browser ends its helpers and frees its profile (about 400 MB), which then goes;
  // a killed browser keeps the files locked and leaves the folder in TEMP
  const close = async active => {
    try {
      const ws = new WebSocket(active)
      await Promise.race([new Promise((r, j) => { ws.onopen = r; ws.onerror = j }), sleep(3000)])
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
    } catch { /* already gone */ }
    await Promise.race([gone, sleep(5000)])
    browser.kill()
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* a file still locked stays behind */ }
  }
  for (let i = 0; i < 120; i++) { // up to 30 s
    await sleep(250)
    let port, path
    try { [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n').map(s => s.trim()) } catch { continue } // not written yet
    const targets = port && path && await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null)
    if (targets) return { browser, targets, close: () => close(`ws://127.0.0.1:${port}${path}`) }
  }
  await close(null)
  throw new Error('The browser did not open its debugging port within 30 seconds')
}
