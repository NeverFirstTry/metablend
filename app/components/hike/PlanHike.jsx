'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill, dayWord } from '@/lib/outlook/text'
import { planDays } from '@/lib/push-days'
import { enablePush, pushApiRegistered, permission } from '@/lib/push-client'
import { syncWidgets } from '@/lib/app-widget-client'
import { simplify } from '@/lib/route/geometry'
import { keepPlanned } from '@/lib/route-store'
import { haptic } from '@/lib/native'
import { plansStore, usePlans } from '@/lib/plans-client'
import { plansAt, upcoming } from '@/lib/plans'

// Plan a hike (app only): pick a day, get the summit window the evening
// before at 18:00 and a morning update if it moves. On a route: the plan
// carries a simplified copy (≤ 150 points) and the alerts give the start.
// `date`: the day already picked on the route; when it can be planned (from tomorrow), one button plans it
// ("Remind me for Sunday") instead of asking "Which day?" again (UX review O5).
// What is planned here shows above it, "Planned for Saturday" with a way to cancel (UX review N2).
export default function PlanHike({ peak, lang, unit, todayLocal, route = null, pace = 'normal', date = null }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(null)
  const mine = upcoming(plansAt(usePlans(), peak, route?.name ?? null), todayLocal)
  const direct = date && planDays(lang, todayLocal).some(d => d.date === date) && !mine.some(p => p.date === date) ? date : null

  async function plan(date) {
    if ((await permission()) !== 'granted') {
      const r = await enablePush({ lang, unit })
      // the reason (Apple's or Google's error, the server's answer) goes to the console, never onto the screen
      if (!r.ok) { if (r.detail) console.warn('push', r.detail); setMsg(r.reason === 'denied' ? t(lang, 'notifBlocked') : t(lang, 'notifError')); return }
    }
    const body = { name: peak.name, lat: peak.lat, lon: peak.lon, elev: peak.elev, date }
    if (route) {
      const pts = simplify(route.points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })), 150)
      body.route = { id: route.id ?? null, name: route.name.slice(0, 80), pace, roundTrip: !!route.roundTrip, points: pts.map(p => [p.lat, p.lon, p.ele]) }
    }
    // a phone the server lost registers again and the plan is sent once more (lib/push-retry.js)
    const r = await pushApiRegistered('plans', { method: 'POST', body }, { lang, unit })
    if (r.status === 200) { haptic('success'); syncWidgets({ refresh: true }); if (r.json.plan) plansStore.add(r.json.plan) }
    // the alert opens the route by its id: keep it on the phone
    if (r.status === 200 && route?.id) await keepPlanned(route)
    setMsg(r.status === 200 ? t(lang, 'planSaved') : t(lang, 'notifError'))
    setOpen(false)
  }

  async function cancel(id) {
    setMsg(null)
    if (await plansStore.cancel(id)) syncWidgets({ refresh: true })
    else setMsg(t(lang, 'notifError'))
  }

  return (
    <div className="space-y-2">
      {mine.map(p => {
        const label = fill(t(lang, 'planPlannedFor'), { day: dayWord(lang, p.date, todayLocal) })
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-200">
            <BellRing size={16} className="text-zinc-400 shrink-0" aria-hidden /> {label}
            <button onClick={() => cancel(p.id)} aria-label={`${t(lang, 'planCancel')}: ${label}`}
              className="press min-h-11 px-2 text-zinc-400 underline underline-offset-2 hover:text-red-300">{t(lang, 'planCancel')}</button>
          </div>
        )
      })}
      {direct ? (
        <button onClick={() => { setMsg(null); plan(direct) }}
          className="press min-h-11 inline-flex items-center gap-1.5 text-sm text-zinc-200 border border-zinc-700 bg-zinc-800 rounded-full px-4 hover:border-emerald-400">
          <BellRing size={16} aria-hidden /> {fill(t(lang, 'planRouteFor'), { day: dayWord(lang, direct, todayLocal) })}
        </button>
      ) : (
      // neutral like Save beside it: gold is the screen's answer, the favourable start (owner, 2026-11-20)
      // (the direct button above says what a plan brings below it; this one in its panel, UX review N1)
      <button onClick={() => { setOpen(o => !o); setMsg(null) }} aria-expanded={open}
        className="press min-h-11 inline-flex items-center gap-1.5 text-sm text-zinc-200 border border-zinc-700 bg-zinc-800 rounded-full px-4 hover:border-emerald-400">
        <BellRing size={16} aria-hidden /> {t(lang, 'planHike')}
      </button>
      )}
      {open && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 animate-fade-in">
          {/* what a plan brings, before the day is picked (UX review N1): it was said only after */}
          <p className="text-sm text-zinc-300">{t(lang, 'planExplain')}</p>
          <div className="text-xs text-zinc-500">{t(lang, 'planPick')}</div>
          <div className="flex flex-wrap gap-1.5">
            {planDays(lang, todayLocal).map(d => (
              <button key={d.date} onClick={() => plan(d.date)} className="press min-h-11 rounded-lg bg-zinc-800 px-3 text-sm hover:text-emerald-400">{d.label}</button>
            ))}
          </div>
        </div>
      )}
      {/* the direct button plans at once: what a plan brings is said before the tap, until 'Planned. ...' says it */}
      {direct && !msg && <p className="text-sm text-zinc-400">{t(lang, 'planExplain')}</p>}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
    </div>
  )
}
