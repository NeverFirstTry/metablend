'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { isNative } from '@/lib/native'
import { enablePush, pushApi, promptState, dismissPrompt, permission } from '@/lib/push-client'

// "Get a heads-up before rain in Vienna?" — app only, from the 3rd forecast
// view, never again once dismissed or once notifications are on.
export default function PushPrompt({ lang, unit }) {
  const [show, setShow] = useState(null) // null | { city } | 'done'
  useEffect(() => {
    if (!isNative()) return
    let off = false
    Promise.all([promptState(), permission(), pushApi('settings')]).then(([st, perm, r]) => {
      const registered = r.status === 200 && r.json.registered
      if (!off && st.views >= 3 && !st.dismissed && perm !== 'denied' && !registered && st.topCity) setShow({ city: st.topCity })
    }).catch(() => {})
    return () => { off = true }
  }, [])
  if (!show) return null
  if (show === 'done') return <p className="text-sm text-zinc-400 animate-fade-in" role="status">{t(lang, 'promptDone')}</p>

  async function turnOn() {
    const r = await enablePush({ lang, unit })
    if (r.ok) {
      await pushApi('settings', { method: 'PUT', body: { home_name: show.city, alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, lang, unit } })
      setShow('done')
    } else {
      await dismissPrompt(); setShow(null)
    }
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in">
      <span className="flex-1 text-sm">{fill(t(lang, 'promptTitle'), { city: show.city })}</span>
      <button onClick={turnOn} className="press bg-emerald-400 text-black text-sm font-semibold rounded-full px-4 py-1.5 hover:bg-emerald-300">{t(lang, 'promptOn')}</button>
      <button onClick={async () => { await dismissPrompt(); setShow(null) }} aria-label="×" className="press text-zinc-500 hover:text-zinc-300"><X size={16} aria-hidden /></button>
    </div>
  )
}
