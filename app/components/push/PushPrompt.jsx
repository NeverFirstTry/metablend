'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { isNative } from '@/lib/native'
import { enablePush, pushApi, promptState, dismissPrompt, permission } from '@/lib/push-client'
import { syncWidgets } from '@/lib/app-widget-client'
import { shouldPrompt, turnOnOutcome, promptSettings, promptWaits } from '@/lib/push-ui'
import { useWarnings } from '@/lib/warnings/useWarnings'

// "Get a heads-up before rain in Vienna?" — app only, from the 3rd forecast
// view, never again once dismissed or once notifications are on.
// city: the place open on the page; the prompt names it and Turn on registers it (owner, 2026-11-22: it named and
// registered the most viewed city, whatever was open). The most viewed one only stands in when none is given.
// lat, lon, cc: the place as the warnings card gets it, so both read one shared answer (lib/push-ui.js promptWaits)
export default function PushPrompt({ lang, unit, city = null, lat = null, lon = null, cc = null }) {
  const [show, setShow] = useState(null) // null | { city } | 'done'
  const warned = useWarnings(lat, lon, lang, cc)
  useEffect(() => {
    if (!isNative()) return
    let off = false
    Promise.all([promptState(), permission()]).then(([st, perm]) => {
      if (!off && shouldPrompt({ ...st, perm })) setShow({ city: st.topCity })
    }).catch(() => {})
    return () => { off = true }
  }, [])
  if (!show) return null
  if (show === 'done') return <p className="text-sm text-zinc-400 animate-fade-in" role="status">{t(lang, 'promptDone')}</p>
  if (promptWaits(lat != null, warned)) return null
  const place = city || show.city

  // "done" only once the server took the phone; a refused permission ends the prompt for good, a failure (no push
  // token, the server refused) says so in the reader's language and the prompt stays (owner, 2026-11-22)
  async function turnOn() {
    const outcome = turnOnOutcome(await enablePush({ lang, unit }))
    if (outcome === 'denied') { await dismissPrompt(); setShow(null); return }
    if (outcome === 'error') { setShow(s => ({ ...s, failed: true })); return }
    // a new phone's row has rain alerts off and no home city: "done" only once they are saved too (Review, 2026-11-22);
    // otherwise the same failed state, and a second tap registers again and saves again. Rain only (lib/push-ui.js)
    const saved = await pushApi('settings', { method: 'PUT', body: promptSettings(place, lang, unit) })
    if (saved.status !== 200) { setShow(s => ({ ...s, failed: true })); return }
    syncWidgets({ refresh: true })
    setShow('done')
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in">
      <span className="flex-1 text-sm">{fill(t(lang, 'promptTitle'), { city: place })}{show.failed && <span className="block text-xs text-zinc-400 mt-1" role="status">{t(lang, 'notifError')}</span>}</span>
      {/* the neutral primary button: the theme's surface and hairline with gold text (--on-fill: deeper in light, to read
          on the surface); gold fill is for the screen's answer */}
      <button onClick={turnOn} className="press shrink-0 bg-[var(--surface-2)] text-[var(--on-fill)] shadow-[inset_0_0_0_1px_var(--hairline)] text-sm font-semibold rounded-full px-4 py-1.5 hover:bg-[var(--surface-3)]">{t(lang, 'promptOn')}</button>
      <button onClick={async () => { await dismissPrompt(); setShow(null) }} aria-label={t(lang, 'promptNotNow')} className="press size-11 shrink-0 inline-flex items-center justify-center text-zinc-500 hover:text-zinc-300"><X size={16} aria-hidden /></button>
    </div>
  )
}
