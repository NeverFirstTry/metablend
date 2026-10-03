// Larger Text in the app: the phone's text-size setting (native TextScale
// plugin) scales the root font size, and with it every rem-based size.
// The website leaves the root alone so the browser's own setting works.
import { isNative } from './native.js'

let plugin = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise (see lib/app-icon.js)

export function clampScale(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.round(Math.min(2, Math.max(1, v)) * 20) / 20
}

export function applyTextScale(scale, root = globalThis.document?.documentElement) {
  if (!root) return
  const s = clampScale(scale)
  root.style.fontSize = s === 1 ? '' : `${16 * s}px`
  // from 1.3 on, one-line truncated texts wrap instead (globals.css)
  if (s >= 1.3) root.dataset.textLarge = '1'
  else delete root.dataset.textLarge
}

// reads the setting now and on every change; resolves to an unsubscribe
export async function watchTextScale() {
  if (!isNative()) return () => {}
  try {
    const { registerPlugin } = await import('@capacitor/core')
    plugin ??= registerPlugin('TextScale')
    applyTextScale((await plugin.get()).scale)
    const sub = await plugin.addListener('change', e => applyTextScale(e.scale))
    return () => sub.remove()
  } catch {
    return () => {} // an older app build without the plugin: normal size
  }
}
