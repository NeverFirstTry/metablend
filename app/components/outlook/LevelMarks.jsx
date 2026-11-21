import { TriangleAlert } from 'lucide-react'
import { levelCount } from '@/lib/warnings/text'

// A warning's level as one to three drawn triangles beside its word (UX review X5: the typed ⚠ showed as a
// coloured emoji on phones). The word says the level; the marks are decoration for the eye only.
export default function LevelMarks({ level, size = 12 }) {
  return (
    <span aria-hidden className="inline-flex gap-0.5 align-[-1px]">
      {Array.from({ length: levelCount(level) }, (_, i) => <TriangleAlert key={i} size={size} />)}
    </span>
  )
}
