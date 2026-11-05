import Link from 'next/link'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { regionName, trustedSources } from '@/lib/trusted'

// The website's short explanation, with the real weights behind the forecast
// on screen. They come with the forecast, so this costs no request.
export default function HowItWorks({ lang, data, weights = data?.weights }) {
  const rows = trustedSources(data?.sources, weights)
  return (
    <section className="web-only mt-16 grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <h2 className="font-semibold tracking-tight mb-4">{t(lang, 'homeHowTitle')}</h2>
        <p className="text-zinc-400 leading-relaxed max-w-prose">{t(lang, 'homeHowText')}</p>
      </div>
      {rows.length > 0 && (
        <div>
          <h3 className="font-semibold flex flex-wrap items-baseline justify-between gap-x-4 mb-4">
            <span>{t(lang, 'homeTrusted')}</span>
            <span className="text-zinc-400 text-sm font-normal">{regionName(lang, data.region)}</span>
          </h3>
          <ol className="space-y-4">
            {rows.map((r, i) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-4 text-sm mb-2">
                  <span>{r.name}</span>
                  <span className="tabular-nums text-zinc-400">{r.share}%</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800" aria-hidden>
                  <div className={`h-1 rounded-full ${i === 0 ? 'home-bar-lead' : 'home-bar'}`} style={{ width: `${(r.share / rows[0].share) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-zinc-400 text-sm mt-4">
            {fill(t(lang, 'homeTrustedHint'), { city: data.city })}{' '}
            <Link href="/leaderboard" className="text-emerald-400 hover:underline">{t(lang, 'leaderboard')}</Link>
          </p>
        </div>
      )}
    </section>
  )
}
