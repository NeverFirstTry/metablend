import { ChevronRight } from 'lucide-react'

const TONES = {
  rain: { box: 'bg-blue-500/10 border-blue-500/40', color: 'var(--info)' },
  ok: { box: 'bg-emerald-400/10 border-emerald-400/40', color: 'var(--ok)' },
  warn: { box: 'bg-amber-400/10 border-amber-400/40', color: 'var(--warn)' },
  neutral: { box: 'bg-zinc-800/60 border-zinc-700', color: 'inherit' },
}

// The one-sentence answer that opens every tab. With onClick it's a button
// (e.g. "No daylight left today → tomorrow's window" opens Tomorrow).
export default function Headline({ text, tone = 'neutral', onClick = null }) {
  if (!text) return null
  const t = TONES[tone] ?? TONES.neutral
  const Box = onClick ? 'button' : 'div'
  return (
    // keyed by the answer: a new answer (another tab, another city) arrives with the entrance again
    <Box key={text.title} type={onClick ? 'button' : undefined} onClick={onClick ?? undefined}
      className={`mb-rise-3 block w-full text-left rounded-2xl border px-5 py-4 ${t.box}${onClick ? ' press' : ''}`}>
      <span className="block text-xl sm:text-2xl font-semibold leading-snug tracking-tight" style={{ color: t.color }}>{text.title}</span>
      {text.sub && (
        <span className="flex items-center gap-1 text-zinc-400 text-sm mt-1.5">
          {text.sub}{onClick && <ChevronRight size={15} className="shrink-0" aria-hidden />}
        </span>
      )}
    </Box>
  )
}
