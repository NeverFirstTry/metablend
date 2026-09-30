'use client'

import { useState } from 'react'
import { Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { t, getWeatherOptions } from '@/lib/i18n'
import { isNightAt } from '@/lib/localtime'

const fToC = f => (f - 32) * 5 / 9

// "How's the weather where you are?" — the community report that re-weights
// the live sources. onWeights(city, weights) lets the page show the new
// weights at once (a re-fetch would only hit the 15-min CDN copy).
export default function FeedbackPanel({ data, unit, lang, onWeights }) {
  const [feedback, setFeedback] = useState({ temp: '', cond: '' })
  const [fbStatus, setFbStatus] = useState(null)
  const [fbLoading, setFbLoading] = useState(false)
  // Night by the CITY's clock, not the viewer's — it gates the "sunny" option,
  // and the server rejects sun at night by the same city-local rule.
  const isNight = isNightAt(data?.lon)

  async function submitFeedback() {
    if (!feedback.temp || !feedback.cond || !data) return
    setFbLoading(true)
    setFbStatus(null)
    // APIs all speak Celsius, so convert before sending if the user typed °F
    const entered = parseFloat(feedback.temp)
    const tempC = unit === 'F' ? Math.round(fToC(entered) * 10) / 10 : entered
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // the name the forecasts are stored under (English), not the shown one
          city: data.learnCity ?? data.city,
          actualTemp: tempC,
          actualCond: feedback.cond,
          lat: data.lat ?? null,
          lon: data.lon ?? null,
        }),
      })
      const json = await res.json()
      if (res.status === 429 || json.error) {
        setFbStatus({ ok: false, msg: json.error })
      } else {
        setFbStatus({ ok: true, msg: json.message })
        if (json.weights) onWeights?.(data.city, json.weights)
      }
    } catch {
      setFbStatus({ ok: false, msg: 'Error sending feedback.' })
    } finally {
      setFbLoading(false)
    }
  }

  return (
    <div>
      <p className="text-zinc-500 text-sm mb-6">{t(lang, 'feedbackSub')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
            {t(lang, 'tempInputLabel')} (°{unit})
          </label>
          <input
            type="number"
            placeholder={unit === 'F' ? 'e.g. 57' : 'e.g. 14'}
            value={feedback.temp}
            onChange={e => setFeedback(f => ({ ...f, temp: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
          />
        </div>
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
            {t(lang, 'conditionLabel')}
          </label>
          <select
            value={feedback.cond}
            onChange={e => setFeedback(f => ({ ...f, cond: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
          >
            <option value="">{t(lang, 'conditionPlaceholder')}</option>
            {getWeatherOptions(lang, isNight).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={submitFeedback}
        disabled={fbLoading || !feedback.temp || !feedback.cond}
        className="press w-full bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {fbLoading
          ? <Loader2 size={16} className="animate-spin-slow" aria-hidden />
          : <Send size={16} aria-hidden />}
        {(fbLoading ? t(lang, 'submittingBtn') : t(lang, 'submitBtn')).replace(/^[^\p{L}]+\s*/u, '')}
      </button>
      {fbStatus && (
        <div className={`animate-scale-in mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${fbStatus.ok
          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
          : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
          {fbStatus.ok
            ? <CheckCircle2 size={16} className="shrink-0" aria-hidden />
            : <AlertTriangle size={16} className="shrink-0" aria-hidden />}
          <span>{fbStatus.msg}</span>
        </div>
      )}
    </div>
  )
}
