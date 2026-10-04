// Larger Text in the app: the phone's text-size setting (native TextScale
// plugin) scales the root font size, and with it every rem-based size.
// The website leaves the root alone so the browser's own setting works.
// The last size is remembered; APP_BOOT_SCRIPT applies it before first paint.
import { isNative } from './native.js'
import { TEXT_SCALE_KEY } from './app-client.js'

let plugin = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise (see lib/app-icon.js)

export function clampScale(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.round(Math.min(2, Math.max(1, v)) * 20) / 20
}

export function applyTextScale(scale, root = globalThis.document?.documentElement) {
  if (!root) return
  const s = clampScale(scale)
  root.style.fontSize = s === 1 ? '' : `${+(16 * s).toFixed(2)}px`
  // from 1.3 on, one-line truncated texts wrap instead (globals.css)
  if (s >= 1.3) root.dataset.textLarge = '1'
  else delete root.dataset.textLarge
}

export function rememberTextScale(scale, storage = globalThis.localStorage) {
  try { storage?.setItem(TEXT_SCALE_KEY, String(clampScale(scale))) } catch { /* private mode: no head start next time */ }
}

// The proxy comes back wrapped in an object — a Capacitor proxy answers every
// property, `then` included, so it must never be a promise's value itself.
// `core` (tests) stands in for @capacitor/core.
async function textScalePlugin(core) {
  if (core) return { p: core.registerPlugin('TextScale') }
  const { registerPlugin } = await import('@capacitor/core')
  plugin ??= registerPlugin('TextScale')
  return { p: plugin }
}

// reads the setting now and on every change; resolves to an unsubscribe
export async function watchTextScale({ native = isNative(), core = null, root, storage } = {}) {
  if (!native) return () => {}
  try {
    const { p } = await textScalePlugin(core)
    const set = scale => { applyTextScale(scale, root); rememberTextScale(scale, storage) }
    set((await p.get()).scale)
    const sub = await p.addListener('change', e => set(e.scale))
    return () => sub.remove()
  } catch {
    return () => {} // an older app build without the plugin: normal size
  }
}
