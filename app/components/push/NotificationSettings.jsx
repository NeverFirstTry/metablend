'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { countryName } from '@/lib/city-names'
import { SectionTitle } from '../ui'
import { pushApi, permission, enablePush, disablePush, promptState, forgetWhenOff } from '@/lib/push-client'
import { canOpenSettings, openSettings } from '@/lib/app-settings'
import { syncWidgets } from '@/lib/app-widget-client'
import { haptic } from '@/lib/native'

const ALERTS = [['alert_rain', 'notifRain'], ['alert_storm', 'notifStorm'], ['alert_severe', 'notifSevere'], ['alert_heat', 'notifHeat']]
const HOURS = [5, 6, 7, 8, 9, 10, 11]

// More → Notifications (app only). Loads the phone's settings from the
// server; every switch saves on its own.
export default function NotificationSettings({ lang, unit }) {
  const [state, setState] = useState({ loading: true, perm: 'prompt', settings: null, plans: [] })
  const [msg, setMsg] = useState(null)
  const [editHome, setEditHome] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const timer = useRef(null)

  // An app build without the push / storage plugins (older than this
  // feature) can't do any of this: say so instead of showing nothing.
  async function load() {
    try {
      const perm = await permission()
      if (perm === 'unavailable') { setState({ loading: false, unavailable: true }); return }
      // turned off in the phone's settings while the app was open: forgotten before the screen shows
      if (perm !== 'granted') await forgetWhenOff().catch(() => {})
      const r = await pushApi('settings')
      setState({ loading: false, perm, settings: r.status === 200 ? r.json.settings : null, plans: r.json.plans ?? [], canOpen: canOpenSettings() })
    } catch {
      setState({ loading: false, unavailable: true })
    }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once after mount
  useEffect(() => { load() }, [])

  async function save(patch) {
    const r = await pushApi('settings', { method: 'PUT', body: { ...patch, lang, unit } })
    if (r.status === 200) { setState(s => ({ ...s, settings: r.json.settings })); syncWidgets({ refresh: true }) }
    else setMsg(t(lang, 'notifError'))
  }

  async function turnOn() {
    const r = await enablePush({ lang, unit })
    if (!r.ok) { setMsg(r.reason === 'denied' ? null : `${t(lang, 'notifError')}${r.detail ? ` (${r.detail})` : ''}`); await load(); return }
    const { topCity } = await promptState()
    await pushApi('settings', { method: 'PUT', body: { home_name: topCity ?? null, alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, lang, unit } })
    syncWidgets({ refresh: true })
    await load()
    if (!topCity) setEditHome(true) // no city viewed yet: pick one, or the alerts have nowhere to look
  }

  // the off switch: the server deletes this phone's push record right away; the screen goes back to "Turn on"
  async function turnOff() {
    if (!(await disablePush().catch(() => false))) { setMsg(t(lang, 'notifError')); return }
    setState(s => ({ ...s, settings: null, plans: [] }))
    setEditHome(false)
    syncWidgets({ refresh: true })
  }

  function search(v) {
    setQuery(v)
    clearTimeout(timer.current)
    if (v.trim().length < 2) { setHits([]); return }
    timer.current = setTimeout(async () => {
      try {
        const d = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=5&language=${lang}`)).json()
        setHits(d.results ?? [])
      } catch { setHits([]) }
    }, 250)
  }

  async function test() {
    const r = await pushApi('test-send', { method: 'POST' })
    setMsg(r.status === 200 ? t(lang, 'notifTestSent') : r.json.error ?? t(lang, 'notifError'))
  }

  async function removePlan(id) {
    await pushApi(`plans?id=${id}`, { method: 'DELETE' })
    syncWidgets({ refresh: true })
    setState(s => ({ ...s, plans: s.plans.filter(p => p.id !== id) }))
  }

  const box = 'bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3'
  const caption = 'text-zinc-500 text-xs uppercase tracking-wider'
  const toggle = (key, label) => (
    <label key={key} className="flex items-center justify-between gap-3 text-sm py-1">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-emerald-400" checked={!!state.settings?.[key]} onChange={e => { haptic('selection'); save({ [key]: e.target.checked }) }} />
    </label>
  )

  if (state.loading) return null
  const s = state.settings
  return (
    <section className="space-y-3">
      <SectionTitle icon={Bell}>{t(lang, 'notifTitle')}</SectionTitle>
      {state.unavailable ? <div className={box}><p className="text-sm">{t(lang, 'notifUpdateApp')}</p></div> : null}
      {state.unavailable ? null : <>
      {state.perm === 'denied' ? (
        <div className={box}>
          <p className="text-sm">{t(lang, 'notifBlocked')}</p>
          <p className="text-xs text-zinc-400">{t(lang, 'notifBlockedHow')}</p>
          {state.canOpen && <button onClick={openSettings} className="press text-sm text-emerald-400 underline underline-offset-4">{t(lang, 'notifOpenSettings')}</button>}
        </div>
      ) : !s ? (
        <div className={box}>
          <button onClick={turnOn} className="press w-full bg-emerald-400 text-black font-semibold rounded-full py-2.5 text-sm hover:bg-emerald-300">{t(lang, 'notifEnable')}</button>
          <p className="text-xs text-zinc-400">{t(lang, 'notifRules')}</p>
        </div>
      ) : (
        <>
          <div className={box}>
            <label className="flex items-center justify-between gap-3 text-sm py-1">
              <span>{t(lang, 'notifOn')}</span>
              <input type="checkbox" role="switch" className="h-5 w-5 accent-emerald-400" checked onChange={() => { haptic('selection'); turnOff() }} />
            </label>
            <p className="text-xs text-zinc-400">{t(lang, 'notifOffDeletes')}</p>
          </div>
          <div className={box}>
            <div className="flex items-center justify-between gap-3">
              <div><div className={caption}>{t(lang, 'notifHome')}</div><div className="text-sm mt-0.5">{s.home_name ?? '–'}</div></div>
              <button onClick={() => setEditHome(v => !v)} className="press text-sm text-emerald-400">{t(lang, 'notifChange')}</button>
            </div>
            {!s.home_name && !editHome && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'notifPickHome')}</p>}
            {editHome && (
              <div className="space-y-1">
                <input value={query} onChange={e => search(e.target.value)} maxLength={80} autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                {hits.map(h => (
                  <button key={h.id} onClick={() => { save({ home_name: h.name }); setEditHome(false); setQuery(''); setHits([]) }}
                    className="press-row block w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800">
                    {h.name}<span className="text-zinc-500"> · {[h.admin1, countryName(h.country_code, lang, h.country)].filter(Boolean).join(', ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={box}>
            <div className={caption}>{t(lang, 'notifAlerts')}</div>
            {ALERTS.map(([k, label]) => toggle(k, t(lang, label)))}
            <p className="text-xs text-zinc-400">{t(lang, 'notifRules')}</p>
          </div>
          <div className={box}>
            {toggle('briefing', t(lang, 'notifBriefing'))}
            {s.briefing && (
              <div className="flex flex-wrap gap-1">
                {HOURS.map(h => (
                  <button key={h} onClick={() => save({ briefing_hour: h })} aria-pressed={s.briefing_hour === h}
                    className={`press rounded-lg px-2.5 py-1 text-xs tabular-nums ${s.briefing_hour === h ? 'bg-emerald-400 text-black font-semibold' : 'bg-zinc-800 text-zinc-400'}`}>
                    {String(h).padStart(2, '0')}:00
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={box}>
            <div className={caption}>{t(lang, 'notifHikes')}</div>
            {state.plans.length ? state.plans.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>⛰ {p.name} · <span className="tabular-nums">{p.date}</span></span>
                <button onClick={() => removePlan(p.id)} aria-label={t(lang, 'planRemove')} className="press text-zinc-500 hover:text-red-400"><Trash2 size={15} aria-hidden /></button>
              </div>
            )) : <p className="text-xs text-zinc-400">{t(lang, 'notifNoHikes')}</p>}
          </div>
          <button onClick={test} className="press text-sm text-emerald-400 underline underline-offset-4">{t(lang, 'notifTest')}</button>
        </>
      )}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
      </>}
    </section>
  )
}
