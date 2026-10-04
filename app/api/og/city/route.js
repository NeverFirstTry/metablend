import { selfBase } from '@/lib/auth'
import { ImageResponse } from 'next/og'
import { t, translateCondition } from '@/lib/i18n'
import { fill, tempFormatter } from '@/lib/outlook/text'
import { skyFor, SKIES } from '@/lib/sky'
import { pickLang, pickUnit } from '@/lib/share'

// The preview card a shared city link shows in chats and feeds: that city's
// weather right now, on its sky. Reads the same CDN-cached forecast and
// outlook the site uses, so a busy share costs no extra API calls.
// GET /api/og/city?name=Vienna&lang=de&unit=C → 1200×630 PNG
const SIZE = { width: 1200, height: 630 }
const TTL = 1800
// through the public domain, not the deployment URL (deployment protection
// 401s server-to-server fetches) — same rule as /weather/[city]
const baseFor = selfBase

const svg = body => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">${body}</svg>`)}`
const CLOUD = '<g fill="#fff"><circle cx="70" cy="92" r="30"/><circle cx="106" cy="76" r="40"/><circle cx="142" cy="98" r="24"/><rect x="40" y="92" width="126" height="34" rx="17"/></g>'
const ICONS = {
  sun: svg('<circle cx="100" cy="80" r="44" fill="#ffd98a"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="100" y1="14" x2="100" y2="24" stroke="#ffd98a" stroke-width="7" stroke-linecap="round" transform="rotate(${a} 100 80)"/>`).join('')),
  moon: svg('<path d="M122 30a52 52 0 1 0 38 78 44 44 0 1 1-38-78z" fill="#f4f1d0"/>'),
  cloud: svg(CLOUD),
  rain: svg(CLOUD + '<g stroke="#a9d1ff" stroke-width="7" stroke-linecap="round"><line x1="72" y1="138" x2="66" y2="154"/><line x1="104" y1="138" x2="98" y2="154"/><line x1="136" y1="138" x2="130" y2="154"/></g>'),
  snow: svg(CLOUD + '<g fill="#e8f1ff"><circle cx="70" cy="146" r="6"/><circle cx="102" cy="150" r="6"/><circle cx="134" cy="146" r="6"/></g>'),
}
const ICON_FOR = { storm: 'rain', rain: 'rain', snow: 'snow', cloudy: 'cloud', night: 'moon' }

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const j = await r.json()
    return j?.error ? null : j
  } catch { return null }
}

export async function GET(req) {
  const u = new URL(req.url)
  const name = (u.searchParams.get('name') ?? '').trim().slice(0, 80)
  const lang = pickLang(u.searchParams.get('lang'))
  const fmtTemp = tempFormatter(pickUnit(u.searchParams.get('unit')))
  const key = encodeURIComponent(name.toLowerCase())
  const [now, out] = name
    ? await Promise.all([getJson(`${baseFor(req)}/api/forecast?city=${key}&lang=${lang}`), getJson(`${baseFor(req)}/api/outlook?city=${key}&lang=${lang}`)])
    : [null, null]

  const skyName = out ? skyFor({ code: out.hourly?.[0]?.code, nowLocal: out.nowLocal, sun: out.sun }) : 'night'
  const [a, b, c] = SKIES[skyName] ?? SKIES.night
  const day = out?.days?.[0]
  const condition = now ? translateCondition(lang, now.sources?.find(s => s.apiId === 'open-meteo' && !s.down)?.condition ?? now.sources?.find(s => !s.down)?.condition ?? '') : ''
  const sources = now?.sources?.filter(s => !s.down).length

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 76px', color: '#f6f8fc', fontFamily: 'sans-serif', background: `radial-gradient(120% 70% at 80% -5%, ${c}55, transparent 62%), linear-gradient(180deg, ${a} 0%, ${b} 52%, ${c} 100%)` }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
          <span>Meta</span><span style={{ color: '#ffd98a' }}>Blend</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -1.5 }}>
              {now?.city ?? (name || 'MetaBlend')}{now?.country ? <span style={{ color: 'rgba(226,234,247,0.62)', fontWeight: 400 }}>, {now.country}</span> : null}
            </div>
            {now ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 8 }}>
                <div style={{ display: 'flex', fontSize: 190, lineHeight: 1, letterSpacing: -6 }}>{fmtTemp(now.consensus.temp)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 28, marginBottom: 26, fontSize: 38 }}>
                  <div style={{ display: 'flex' }}>{condition}</div>
                  {day ? <div style={{ display: 'flex', color: 'rgba(226,234,247,0.74)', marginTop: 6 }}>↑ {fmtTemp(day.tempMax)}   ↓ {fmtTemp(day.tempMin)}</div> : null}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 44, color: 'rgba(226,234,247,0.74)', marginTop: 16 }}>{t(lang, 'shareDesc')}</div>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements */}
          <img src={ICONS[ICON_FOR[skyName] ?? 'sun']} width={300} height={240} alt="" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, color: 'rgba(226,234,247,0.74)' }}>
          <div style={{ display: 'flex' }}>{now ? fill(t(lang, 'widgetSources'), { n: sources, agree: now.consensus.confidencePct }) : ''}</div>
          <div style={{ display: 'flex', color: '#ffd98a' }}>metablend.app</div>
        </div>
      </div>
    ),
    { ...SIZE, headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` } },
  )
}
