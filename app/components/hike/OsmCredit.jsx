import { t } from '@/lib/i18n'

// Under summits and huts from OpenStreetMap (ODbL; Nominatim's usage policy
// asks for attribution where its results are shown).
export default function OsmCredit({ lang }) {
  return (
    <p className="text-[0.6875rem] text-zinc-500 px-1">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline-offset-2 hover:underline">
        {t(lang, 'hikeOsmCredit')}
      </a>
    </p>
  )
}
