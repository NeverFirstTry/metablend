// Capacitor plugins are Proxies that answer every property — `then` too —
// with a method. Returned from an async function (or awaited), one looks
// like a promise and is waited on forever. So a plugin is only ever handed
// over inside a plain object: const { plugin } = await loadPlugin(...).
export async function loadPlugin(importer, name) {
  const mod = await importer()
  return { plugin: mod[name] }
}
