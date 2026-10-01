'use client'

import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { t } from '@/lib/i18n'
import { currentIcon, setIcon } from '@/lib/app-icon'
import { iconChoices, selectedIcon, switchNeedsWarning } from '@/lib/app-icon-choices'
import { SectionTitle } from './ui'

const LABEL = { auto: 'appIconAuto', light: 'appIconLight', dark: 'appIconDark', sky: 'appIconSky' }

// More → App icon. Renders nothing until the phone answers (website, or an
// app build without the AppIcon plugin: never).
export default function AppIconPicker({ lang }) {
  const [state, setState] = useState(null) // { platform, name }
  const [pending, setPending] = useState(null) // Android: the icon waiting for "Switch icon"
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    currentIcon().then(r => { if (!gone && r) setState({ platform: r.platform, name: selectedIcon(r.platform, r.name) }) })
    return () => { gone = true }
  }, [])

  if (!state) return null

  async function choose(name, confirmed = false) {
    if (busy || name === state.name) return
    if (switchNeedsWarning(state.platform) && !confirmed) { setPending(name); return }
    setBusy(true)
    const ok = await setIcon(name)
    setBusy(false)
    setPending(null)
    if (ok) setState(s => ({ ...s, name }))
  }

  return (
    <section className="space-y-3">
      <SectionTitle icon={Palette}>{t(lang, 'appIconTitle')}</SectionTitle>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {iconChoices(state.platform).map(name => {
            const on = state.name === name || pending === name
            return (
              <button key={name} type="button" onClick={() => choose(name)} aria-pressed={state.name === name} disabled={busy}
                className="press flex flex-col items-center gap-1.5 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- 56-px static previews, nothing to optimise */}
                <img src={`/app-icons/${name}.png`} alt="" width="56" height="56" className="rounded-[22%]"
                  style={{ outline: on ? '2px solid var(--accent)' : 'none', outlineOffset: 3 }} />
                <span style={{ color: on ? 'var(--accent)' : 'var(--muted)' }}>{t(lang, LABEL[name])}</span>
              </button>
            )
          })}
        </div>
        {state.platform === 'ios' && <p className="text-xs text-zinc-500">{t(lang, 'appIconAutoHint')}</p>}
        {pending && (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'appIconAndroidWarn')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => choose(pending, true)} disabled={busy}
                className="press bg-emerald-400 text-black font-semibold rounded-full px-4 py-2 text-sm hover:bg-emerald-300">{t(lang, 'appIconSwitch')}</button>
              <button type="button" onClick={() => setPending(null)} className="press text-sm text-emerald-400">{t(lang, 'appIconCancel')}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
