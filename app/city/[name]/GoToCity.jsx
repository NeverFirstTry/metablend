'use client'

import { useEffect } from 'react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import SkyLoader from '../../components/SkyLoader'

// A shared link's landing: straight on to that city's forecast, replacing
// this page in the history so back doesn't bounce here again.
export default function GoToCity({ city }) {
  const lang = useLang()
  const href = `/?city=${encodeURIComponent(city)}`
  useEffect(() => { window.location.replace(href) }, [href])
  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-16 text-center">
      <SkyLoader lang={lang} title={t(lang, 'loadingForecast')} names={[]} />
      <a href={href} className="text-sm text-zinc-400 underline underline-offset-4 hover:text-emerald-400">{t(lang, 'openForecast')}</a>
    </main>
  )
}
