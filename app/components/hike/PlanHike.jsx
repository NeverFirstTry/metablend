'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { t } from '@/lib/i18n'
import { planDays } from '@/lib/push-days'
import { enablePush, pushApi, permission } from '@/lib/push-client'

// 🔔 Plan a hike (app only): pick a day, get the summit window the evening
// before at 18:00 and a morning update if it moves.
export default function PlanHike({ peak, lang, unit, todayLocal }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(null)

  async function plan(date) {
    if ((await permission()) !== 'granted') {
      const r = await enablePush({ lang, unit })
      if (!r.ok) { setMsg(t(lang, r.reason === 'denied' ? 'notifBlocked' : 'notifError')); return }
    }
    const r = await pushApi('plans', { method: 'POST', body: { name: peak.name, lat: peak.lat, lon: peak.lon, elev: peak.elev, date } })
    setMsg(r.status === 200 ? t(lang, 'planSaved') : r.json.error ?? t(lang, 'notifError'))
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <button onClick={() => { setOpen(o => !o); setMsg(null) }} aria-expanded={open}
        className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10">
        <BellRing size={14} aria-hidden /> {t(lang, 'planHike')}
      </button>
      {open && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 animate-fade-in">
          <div className="text-xs text-zinc-500">{t(lang, 'planPick')}</div>
          <div className="flex flex-wrap gap-1.5">
            {planDays(lang, todayLocal).map(d => (
              <button key={d.date} onClick={() => plan(d.date)} className="press rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:text-emerald-400">{d.label}</button>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
    </div>
  )
}
