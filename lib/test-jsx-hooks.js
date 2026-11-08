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
  + 'export const useRouter = () => router; export const usePathname = () => "/"; export const useSearchParams = () => new URLSearchParams();')
const onDisk = base => ['', '.js', '.jsx'].map(e => base + e).find(p => fs.existsSync(p) && fs.statSync(p).isFile())

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return next('next/link.js', ctx)
    if (spec === 'next/navigation') return { url: NAVIGATION, shortCircuit: true }
    const ours = ctx.parentURL?.startsWith('file:') && !ctx.parentURL.includes('/node_modules/')
    const file = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2))
      : ours && spec.startsWith('.') ? fileURLToPath(new URL(spec, ctx.parentURL)) : null
    const hit = file && onDisk(file)
    return next(hit ? pathToFileURL(hit).href : spec, ctx)
  },
  load(url, ctx, next) {
    if (!url.startsWith(APP)) return next(url, ctx)
    const { outputText } = ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), {
      fileName: 'page.jsx',
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  },
})
