// The app icon (app only): which one the phone shows, and switching it,
// through the native AppIcon plugin. null / false on the website and in app
// builds without the plugin, so the picker simply doesn't appear there.
import { isNative } from './native'

let plugin = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise

async function load() {
  const { registerPlugin } = await import('@capacitor/core')
  plugin ??= registerPlugin('AppIcon')
}

// { name: 'auto' | 'light' | 'dark' | 'sky', platform: 'ios' | 'android' } or null
export async function currentIcon() {
  if (!isNative()) return null
  try {
    await load()
    const r = await plugin.get()
    return r?.platform ? { name: r.name ?? null, platform: r.platform } : null
  } catch {
    return null
  }
}

export async function setIcon(name) {
  try {
    await load()
    await plugin.set({ name })
    return true
  } catch {
    return false
  }
}
