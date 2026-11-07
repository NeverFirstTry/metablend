import { tempFormatter } from '@/lib/outlook/text'
import { liveSources } from '@/lib/spread'

// Every live source on one quiet line, the blend as the only coloured mark.
// Nothing stacks: close readings overlap and read denser. The scale is centred
// on the blend and at least ±4°, so a tight day reads tight. The website's
// version of SourceSpread, which the app keeps.
export default function SourceDots({ sources, consensusC, unit = 'C', title, hint, brand = 'MetaBlend' }) {
  const live = liveSources(sources)
  if (live.length < 2 || typeof consensusC !== 'number') return null
  const deg = c => tempFormatter(unit)(c).replace('-', '−')
  const half = Math.max(4, Math.ceil(Math.max(...live.map(s => Math.abs(s.temp - consensusC))) + 1))
  const label = `${brand} ${deg(consensusC)}`
  return (
    <div>
      <div className="text-zinc-500 text-xs mb-2">{title}</div>
      <div role="img" aria-label={`${title}: ${(sources ?? []).filter(s => !s.down && !s.synthetic).length} · ${label}`}>
        <div className="text-center text-xs font-semibold tabular-nums mb-1" style={{ color: 'var(--accent)' }}>{label}</div>
        <div className="relative h-5" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'color-mix(in srgb, var(--foreground) 16%, transparent)' }} />
          {live.map(s => (
            <span
              key={s.apiId}
              title={`${s.displayName ?? s.apiId}: ${deg(s.temp)}`}
              className="absolute top-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${((s.temp - consensusC + half) / (2 * half)) * 100}%`, background: 'color-mix(in srgb, var(--foreground) 50%, transparent)' }}
            />
          ))}
          <div className="absolute inset-y-0 left-1/2 w-0.5 rounded-full -translate-x-1/2" style={{ background: 'var(--accent)' }} />
        </div>
        <div className="flex justify-between text-xs text-zinc-500 tabular-nums mt-1" aria-hidden>
          <span>{deg(consensusC - half)}</span>
          <span>{deg(consensusC + half)}</span>
        </div>
      </div>
      <p className="text-zinc-500 text-xs mt-2">{hint}</p>
    </div>
  )
}
