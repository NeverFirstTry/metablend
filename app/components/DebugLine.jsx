'use client'

import { useEffect, useState } from 'react'
import { showDebugLine } from '@/lib/app-client'

// Temporary diagnostic (2026-11-08): the iPhone build shows the website layout.
// What the boot script saw at first paint (window.__mbBoot) next to the page's
// state now, so a phone can tell "never recognised" from "recognised, then lost
// in hydration". Shows by itself inside a native shell without <html data-app>,
// and on any page with ?debug=1. Remove once the cause is fixed.
// every visible text node under a root, whitespace folded, scripts, styles and this block left out
const textNodes = root => {
  const out = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const p = n.parentElement?.tagName
    if (p === 'SCRIPT' || p === 'STYLE' || p === 'PRE' || p === 'NOSCRIPT') continue
    const t = n.nodeValue.replace(/\s+/g, ' ').trim()
    if (t) out.push(t)
  }
  return out
}

// the server's text nodes (the HTML this address serves) against the client's, taken right after hydration
async function diffServerText(client) {
  const res = await fetch(window.location.pathname + window.location.search, { cache: 'no-store', headers: { accept: 'text/html' } })
  const server = textNodes(new DOMParser().parseFromString(await res.text(), 'text/html').body)
  const diffs = []
  for (let i = 0, j = 0; (i < server.length || j < client.length) && diffs.length < 4; i++, j++) {
    if (server[i] === client[j]) continue
    diffs.push(`#${i} server="${(server[i] ?? '∅').slice(0, 70)}" client="${(client[j] ?? '∅').slice(0, 70)}"`)
    const k = client.indexOf(server[i + 1], j) // resync on the next shared text, so one extra node doesn't shift the rest
    if (k > j) j = k - 1
  }
  return [`text nodes: server=${server.length} client=${client.length}`, ...(diffs.length ? diffs : ['no text differences'])]
}

export default function DebugLine() {
  const [lines, setLines] = useState(null)
  useEffect(() => {
    const cap = window.Capacitor
    const native = !!cap?.isNativePlatform?.()
    const html = document.documentElement
    if (!showDebugLine({ search: window.location.search, native, marked: html.dataset.app === '1' })) return
    const boot = window.__mbBoot
    const clientText = textNodes(document.body) // now, before the language swap re-renders the page
    diffServerText(clientText).then(d => setLines(l => (l ? [...l, ...d] : l))).catch(e => setLines(l => (l ? [...l, `diff failed: ${e.message}`] : l)))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration environment read
    setLines([
      `ua: ${navigator.userAgent}`,
      `boot: ${boot ? `app=${boot.app} ua-has-MetaBlendApp=${/MetaBlendApp/.test(boot.ua)} cookie=${boot.cookie || '(none)'}` : 'no stash (old page?)'}`,
      `now: data-app=${html.dataset.app ?? '-'} data-theme=${html.dataset.theme ?? '-'} lang=${html.lang} cookie=${document.cookie || '(none)'}`,
      `shell: ${cap ? `${cap.getPlatform?.() ?? '?'} native=${native}` : 'no Capacitor'} secure=${window.isSecureContext} top=${window.top === window.self} localizing=${html.dataset.localizing ?? '-'}`,
      `errors: ${(window.__mbErrors ?? []).slice(0, 4).join(' | ') || '(none)'}`,
    ])
  }, [])
  if (!lines) return null
  return (
    <pre style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, margin: 0, padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#0f151b', color: '#ffd98a', borderBottom: '1px solid #ffd98a', userSelect: 'text', WebkitUserSelect: 'text' }}>
      {lines.join('\n')}
    </pre>
  )
}
