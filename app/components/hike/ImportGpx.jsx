'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { t } from '@/lib/i18n'
import { parseGpx } from '@/lib/route/gpx'
import { simplify } from '@/lib/route/geometry'
import { saveRoute } from '@/lib/route-store'

const MAX_BYTES = 5 * 1024 * 1024
const r5 = v => Math.round(v * 1e5) / 1e5

// Hiking → Import GPX: the file is read on the phone, simplified and saved to
// My routes right away (so back and reopening work), then opened.
export default function ImportGpx({ lang }) {
  const router = useRouter()
  const [msg, setMsg] = useState(null)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) { setMsg(t(lang, 'gpxTooBig')); return }
    const g = parseGpx(await file.text().catch(() => ''))
    if (!g) { setMsg(t(lang, 'gpxBad')); return }
    const route = {
      id: `gpx-${Date.now().toString(36)}`,
      name: g.name ?? file.name.replace(/\.gpx$/i, ''),
      source: 'gpx', roundTrip: false, savedAt: Date.now(),
      points: simplify(g.points, 500).map(p => [r5(p.lat), r5(p.lon), p.ele == null ? null : Math.round(p.ele)]),
    }
    await saveRoute(route)
    router.push(`/hike?route=${route.id}`)
  }

  return (
    <div className="space-y-1">
      <label className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10 cursor-pointer">
        <Upload size={14} aria-hidden /> {t(lang, 'importGpx')}
        <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml,application/octet-stream" className="sr-only" onChange={pick} />
      </label>
      {msg && <p className="text-xs" role="alert" style={{ color: 'var(--warn)' }}>{msg}</p>}
    </div>
  )
}
