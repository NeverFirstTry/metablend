import { Thermometer, Snowflake, CloudRain, AlertTriangle } from 'lucide-react'
import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'

function RecordCard({ icon: Icon, cls, label, value, date }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
      <div className={`${cls} text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5`}><Icon size={13} aria-hidden /> {label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-zinc-500 text-xs mt-1">{date}</div>
    </div>
  )
}

// Hottest day, coldest night and wettest day of this month over 10 years.
export default function Records({ records: r, nowTemp, lang, fmt }) {
  if (!r || !(r.hottest || r.coldest || r.wettest)) return null
  const near = nowTemp != null && (
    (r.hottest && Math.abs(nowTemp - r.hottest.temp) <= 2) ||
    (r.coldest && Math.abs(nowTemp - r.coldest.temp) <= 2)
  )
  const date = d => (d ? formatCalendarDate(d, lang, { day: '2-digit', month: 'short', year: '2-digit' }) : '')
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {r.hottest && <RecordCard icon={Thermometer} cls="text-orange-400" label={t(lang, 'recordHottest')} value={fmt.fmtTemp(r.hottest.temp)} date={date(r.hottest.date)} />}
        {r.coldest && <RecordCard icon={Snowflake} cls="text-blue-400" label={t(lang, 'recordColdest')} value={fmt.fmtTemp(r.coldest.temp)} date={date(r.coldest.date)} />}
        {r.wettest && <RecordCard icon={CloudRain} cls="text-cyan-400" label={t(lang, 'recordWettest')} value={`${r.wettest.mm} mm`} date={date(r.wettest.date)} />}
      </div>
      {near && <div className="mt-4 text-sm text-orange-300 flex items-center gap-1.5"><AlertTriangle size={14} aria-hidden /> {t(lang, 'recordNear')}</div>}
    </>
  )
}
