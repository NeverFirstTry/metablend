import { t } from '@/lib/i18n'

// One calm sentence under the page title: forecasts can be wrong, do not rely on them alone for
// safety-critical decisions. Website and app alike; the home page prints the same key in its own line.
export default function Disclaimer({ lang = 'en', className = '' }) {
  return <p className={`text-sm text-zinc-500 leading-relaxed ${className}`}>{t(lang, 'forecastDisclaimer')}</p>
}
