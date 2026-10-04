import { packFor } from '@/lib/i18n'

// One language's texts inline, for a page the server renders in that language:
// its client components hydrate in the same language without first fetching
// the pack (lib/i18n-registry.js reads self.__mbPacks). Place it above them.
export default function LangPack({ lang }) {
  const pack = lang === 'en' ? null : packFor(lang)
  if (!pack) return null
  // "<" escaped so no text can close the script tag
  const json = JSON.stringify(pack).replace(/</g, '\\u003c')
  return <script dangerouslySetInnerHTML={{ __html: `(self.__mbPacks=self.__mbPacks||{})[${JSON.stringify(lang)}]=${json}` }} />
}
