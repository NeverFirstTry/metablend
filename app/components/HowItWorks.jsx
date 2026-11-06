import Link from 'next/link'
import { t } from '@/lib/i18n'
import { regionName, trustedSources } from '@/lib/trusted'

// The website's short explanation, with the sources that have done best lately
// where the forecast on screen is. That comes with the forecast: no extra request.
export default function HowItWorks({ lang, data }) {
  const rows = trustedSources(data?.sources, data?.weights, data?.recentScores)
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
                <div className="text-sm mb-2">{r.name}</div>
                <div className="h-1 rounded-full bg-zinc-800" aria-hidden>
                  <div className={`h-1 rounded-full ${i === 0 ? 'home-bar-lead' : 'home-bar'}`} style={{ width: `${r.bar}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-zinc-400 text-sm mt-4">
            {t(lang, 'homeTrustedHint')}{' '}
            <Link href="/leaderboard" className="text-emerald-400 hover:underline">{t(lang, 'leaderboard')}</Link>
          </p>
        </div>
      )}
    </section>
  )
}
