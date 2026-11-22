'use client'

import { useState } from 'react'
import { BellRing, CalendarCheck, CalendarPlus } from 'lucide-react'
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
// Without notifications a plan stays on the phone: it shows in the Mountains tab and the "Next hike" widget, and one
// line says that alerts need notifications, with a way to turn them on (owner, 2026-11-22). With them, as before.
export default function PlanHike({ peak, lang, unit, todayLocal, route = null, pace = 'normal', date = null }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(null)
  const list = usePlans()
  // not loaded yet counts as on, so the line does not flash for someone whose alerts are on
  const alertsOn = list === null || plansStore.alertsOn()
  const mine = upcoming(plansAt(list, peak, route?.name ?? null), todayLocal)
  const direct = date && planDays(lang, todayLocal).some(d => d.date === date) && !mine.some(p => p.date === date) ? date : null

  async function plan(date) {
    const body = { name: peak.name, lat: peak.lat, lon: peak.lon, elev: peak.elev, date }
    if (route) {
      const pts = simplify(route.points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })), 150)
      body.route = { id: route.id ?? null, name: route.name.slice(0, 80), pace, roundTrip: !!route.roundTrip, points: pts.map(p => [p.lat, p.lon, p.ele]) }
    }
    // with notifications the server keeps the plan and sends its alerts; a phone the server lost registers again and
    // the plan is sent once more (lib/push-retry.js, only for a phone that opted in). Without notifications, or still
    // unknown to the server after that (404: off in the app), the plan stays on the phone, never asking first
    const r = (await permission()) === 'granted' ? await pushApiRegistered('plans', { method: 'POST', body }, { lang, unit }) : { status: 404 }
    if (r.status === 404) {
      await plansStore.addLocal(body)
      if (route?.id) await keepPlanned(route)
      haptic('success')
      syncWidgets({ refresh: true })
      setMsg(fill(t(lang, 'planSavedLocal'), { tab: t(lang, 'hiking') }))
      setOpen(false)
      return
    }
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

  // the line's Turn on: notifications on, then the phone's plans go to the server and get their alerts
  async function turnOnAlerts() {
    setMsg(null)
    const r = await enablePush({ lang, unit })
    // the reason (Apple's or Google's error, the server's answer) goes to the console, never onto the screen
    if (!r.ok) { if (r.detail) console.warn('push', r.detail); setMsg(r.reason === 'denied' ? t(lang, 'notifBlocked') : t(lang, 'notifError')); return }
    await plansStore.promote()
    syncWidgets({ refresh: true })
    setMsg(t(lang, 'planExplain'))
  }

  // the buttons' icon: the bell only when a reminder will come (Review, 2026-11-22); with alerts off, a calendar
  const ButtonMark = alertsOn ? BellRing : CalendarPlus

  // one short line while alerts are off: they need notifications, and a way to turn them on (owner, 2026-11-22)
  const alertsLine = !alertsOn && (
    <p className="text-sm text-zinc-400">
      {t(lang, 'planAlertsNeedNotif')}{' '}
      <button type="button" onClick={turnOnAlerts} className="press min-h-11 px-1 text-zinc-200 underline underline-offset-2">{t(lang, 'promptOn')}</button>
    </p>
  )

  return (
    <div className="space-y-2">
      {mine.map(p => {
        const label = fill(t(lang, 'planPlannedFor'), { day: dayWord(lang, p.date, todayLocal) })
        // a plan kept on the phone brings no alert: a calendar tick, not the bell
        const Mark = p.local ? CalendarCheck : BellRing
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-200">
            <Mark size={16} className="text-zinc-400 shrink-0" aria-hidden /> {label}
            <button onClick={() => cancel(p.id)} aria-label={`${t(lang, 'planCancel')}: ${label}`}
              className="press min-h-11 px-2 text-zinc-400 underline underline-offset-2 hover:text-red-300">{t(lang, 'planCancel')}</button>
          </div>
        )
      })}
      {direct ? (
        <button onClick={() => { setMsg(null); plan(direct) }}
          className="press min-h-11 inline-flex items-center gap-1.5 text-sm text-zinc-200 border border-zinc-700 bg-zinc-800 rounded-full px-4 hover:border-emerald-400">
          <ButtonMark size={16} aria-hidden /> {fill(t(lang, alertsOn ? 'planRouteFor' : 'planDayFor'), { day: dayWord(lang, direct, todayLocal) })}
        </button>
      ) : (
      // neutral like Save beside it: gold is the screen's answer, the favourable start (owner, 2026-11-20)
      // (the direct button above says what a plan brings below it; this one in its panel, UX review N1)
      <button onClick={() => { setOpen(o => !o); setMsg(null) }} aria-expanded={open}
        className="press min-h-11 inline-flex items-center gap-1.5 text-sm text-zinc-200 border border-zinc-700 bg-zinc-800 rounded-full px-4 hover:border-emerald-400">
        <ButtonMark size={16} aria-hidden /> {t(lang, 'planHike')}
      </button>
      )}
      {open && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 animate-fade-in">
          {/* what a plan brings, before the day is picked (UX review N1): it was said only after; without
              notifications the alerts are not promised, the line says what they need */}
          {alertsOn ? <p className="text-sm text-zinc-300">{t(lang, 'planExplain')}</p> : alertsLine}
          <div className="text-xs text-zinc-500">{t(lang, 'planPick')}</div>
          <div className="flex flex-wrap gap-1.5">
            {planDays(lang, todayLocal).map(d => (
              <button key={d.date} onClick={() => plan(d.date)} className="press min-h-11 rounded-lg bg-zinc-800 px-3 text-sm hover:text-emerald-400">{d.label}</button>
            ))}
          </div>
        </div>
      )}
      {/* the direct button plans at once: what a plan brings is said before the tap, until 'Planned. ...' says it */}
      {direct && !msg && alertsOn && <p className="text-sm text-zinc-400">{t(lang, 'planExplain')}</p>}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
      {!open && (direct || msg) && alertsLine}
    </div>
  )
}
