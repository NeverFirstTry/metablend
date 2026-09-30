const TONES = {
  rain: { box: 'bg-blue-500/10 border-blue-500/40', color: 'var(--info)' },
  ok: { box: 'bg-emerald-400/10 border-emerald-400/40', color: 'var(--ok)' },
  warn: { box: 'bg-amber-400/10 border-amber-400/40', color: 'var(--warn)' },
  neutral: { box: 'bg-zinc-800/60 border-zinc-700', color: 'inherit' },
}

// The one-sentence answer that opens every tab.
export default function Headline({ text, tone = 'neutral' }) {
  if (!text) return null
  const t = TONES[tone] ?? TONES.neutral
  return (
    // keyed by the answer: a new answer (another tab, another city) arrives with the entrance again
    <div key={text.title} className={`mb-rise-3 mb-glass rounded-2xl border px-5 py-4 ${t.box}`}>
      <div className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight" style={{ color: t.color }}>{text.title}</div>
      {text.sub && <div className="text-zinc-400 text-sm mt-1.5">{text.sub}</div>}
    </div>
  )
}
