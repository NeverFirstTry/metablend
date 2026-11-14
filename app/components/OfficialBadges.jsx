import { t } from '@/lib/i18n'
import { STORES } from '@/lib/hike/stores'

// The stores' own badges (owner 2026-11-13), unaltered, in the reader's language (public/badges/: Apple's from its
// marketing tools, Google's from play.google.com with the empty margin trimmed). Apple's rules: App Store first, the
// black badge when another store's stands beside it, at least 40 px high, a quarter of the height clear all round,
// one App Store badge per page (so a page that shows this pair passes badges={false} to its Footer). Google's: never
// smaller than the badges beside it, so both are 40 px high. Only stores with a URL show (lib/hike/stores.js).
// Website only: an iOS app may not show Google Play, and the app is already installed.
export const BADGE_LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

export default function OfficialBadges({ lang, className = '' }) {
  const l = BADGE_LANGS.includes(lang) ? lang : 'en'
  const badges = [
    [STORES.ios, `/badges/app-store-${l}.svg`, 'badgeAppStore'],
    [STORES.android, `/badges/google-play-${l}.png`, 'badgeGooglePlay'],
  ].filter(([url]) => url)
  if (!badges.length) return null
  return (
    <div className={`web-only flex flex-wrap gap-3 ${className}`}>
      {badges.map(([href, src, key]) => (
        <a key={key} href={href} className="block rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- the stores' files as supplied, not re-encoded */}
          <img src={src} alt={t(lang, key)} className="block h-10 w-auto" />
        </a>
      ))}
    </div>
  )
}

// The trademark lines for the stores shown, as Apple and Google word them (English in every language: they are
// the owners' own sentences). Apple asks for them once, where the site gives its legal notices: the footer.
export function badgeCredits() {
  return [
    STORES.ios && 'Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries. App Store is a service mark of Apple Inc.',
    STORES.android && 'Google Play and the Google Play logo are trademarks of Google LLC.',
  ].filter(Boolean)
}
