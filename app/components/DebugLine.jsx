'use client'

import { useEffect, useState } from 'react'
import { showDebugLine } from '@/lib/app-client'

// Temporary diagnostic (2026-11-08): the iPhone build shows the website layout.
// What the boot script saw at first paint (window.__mbBoot) next to the page's
// state now, so a phone can tell "never recognised" from "recognised, then lost
// in hydration". Shows by itself inside a native shell without <html data-app>,
// and on any page with ?debug=1. Remove once the cause is fixed.
export default function DebugLine() {
  const [lines, setLines] = useState(null)
  useEffect(() => {
    const cap = window.Capacitor
    const native = !!cap?.isNativePlatform?.()
    const html = document.documentElement
    if (!showDebugLine({ search: window.location.search, native, marked: html.dataset.app === '1' })) return
    const boot = window.__mbBoot
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration environment read
    setLines([
      `ua: ${navigator.userAgent}`,
      `boot: ${boot ? `app=${boot.app} ua-has-MetaBlendApp=${/MetaBlendApp/.test(boot.ua)} cookie=${boot.cookie || '(none)'}` : 'no stash (old page?)'}`,
      `now: data-app=${html.dataset.app ?? '-'} data-theme=${html.dataset.theme ?? '-'} lang=${html.lang} cookie=${document.cookie || '(none)'}`,
      `shell: ${cap ? `${cap.getPlatform?.() ?? '?'} native=${native}` : 'no Capacitor'} secure=${window.isSecureContext} top=${window.top === window.self}`,
    ])
  }, [])
  if (!lines) return null
  return (
    <pre style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, margin: 0, padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#0f151b', color: '#ffd98a', borderBottom: '1px solid #ffd98a', userSelect: 'text', WebkitUserSelect: 'text' }}>
      {lines.join('\n')}
    </pre>
  )
}
