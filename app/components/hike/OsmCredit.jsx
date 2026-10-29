import { t } from '@/lib/i18n'

// Under summits and huts from OpenStreetMap (ODbL) — and, with a town's
// surroundings, the town from GeoNames (CC BY 4.0).
const link = 'hover:text-emerald-400 underline-offset-2 hover:underline'
export default function OsmCredit({ lang, towns = false }) {
  return (
    <p className="text-[0.6875rem] text-zinc-500 px-1">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className={link}>{t(lang, 'hikeOsmCredit')}</a>
      {towns && <>{' · '}<a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className={link}>{t(lang, 'hikeGeoNamesCredit')}</a></>}
    </p>
  )
}
