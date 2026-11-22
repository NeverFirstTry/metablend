import { ChevronRight } from 'lucide-react'

// answer: the card that carries the screen's answer (a summit window, the week's best day) in gold, the one job gold
// has there (X3, owner 2026-11-20); without an answer the card is neutral; green is for status words only.
// Its text is --on-fill: the gold in dark, a deeper amber in light, where the gold on its own tint read 4.1:1
const TONES = {
  answer: { box: 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-[color-mix(in_srgb,var(--accent)_40%,transparent)]', color: 'var(--on-fill)' },
  rain: { box: 'bg-blue-500/10 border-blue-500/40', color: 'var(--info)' },
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
      className={`home-headline mb-rise-3 block w-full text-left rounded-2xl border px-5 py-4 ${t.box}${onClick ? ' press' : ''}`}>
      <span className="block text-xl sm:text-2xl font-semibold leading-snug tracking-tight" style={{ color: t.color }}>{text.title}</span>
      {text.sub && (
        <span className="flex items-center gap-1 text-zinc-400 text-sm mt-1.5">
          {text.sub}{onClick && <ChevronRight size={15} className="shrink-0" aria-hidden />}
        </span>
      )}
    </Box>
  )
}
