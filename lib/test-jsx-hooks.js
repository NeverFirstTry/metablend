// Lets a node:test file render the app's components for real. Node can't load JSX
// or the app's @/ and extensionless imports by itself; these hooks do it for the
// test file that imports this module (first, before any component import).
// next/navigation needs Next's router on the page: a test gets a quiet stand-in.
import fs from 'node:fs'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const APP = new URL('../app/', import.meta.url).href
const NAVIGATION = 'data:text/javascript,' + encodeURIComponent(
  'const router = { push() {}, replace() {}, back() {}, refresh() {}, prefetch() {} };'
  + 'export const useRouter = () => router; export const usePathname = () => "/"; export const useSearchParams = () => new URLSearchParams();'
  // a server page's notFound() / redirect() end the render with a throw, as in Next
  + 'export const notFound = () => { throw new Error("NEXT_NOT_FOUND") }; export const redirect = url => { throw new Error("NEXT_REDIRECT " + url) };')
const onDisk = base => ['', '.js', '.jsx'].map(e => base + e).find(p => fs.existsSync(p) && fs.statSync(p).isFile())

registerHooks({
  resolve(spec, ctx, next) {
    // Next's entry points (next/link, next/server, next/og, next/headers) are files without an exports map
    if (['next/link', 'next/server', 'next/og', 'next/headers'].includes(spec)) return next(`${spec}.js`, ctx)
    if (spec === 'next/navigation') return { url: NAVIGATION, shortCircuit: true }
    const ours = ctx.parentURL?.startsWith('file:') && !ctx.parentURL.includes('/node_modules/')
    const file = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2))
      : ours && spec.startsWith('.') ? fileURLToPath(new URL(spec, ctx.parentURL)) : null
    const hit = file && onDisk(file)
    return next(hit ? pathToFileURL(hit).href : spec, ctx)
  },
  load(url, ctx, next) {
    // the app imports its own JSON data the bundler's way, without `with { type: 'json' }`
    if (url.startsWith('file:') && url.endsWith('.json') && !url.includes('/node_modules/')) return next(url, { ...ctx, importAttributes: { ...ctx.importAttributes, type: 'json' } })
    if (!url.startsWith(APP)) return next(url, ctx)
    const { outputText } = ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), {
      fileName: 'page.jsx',
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  },
})
