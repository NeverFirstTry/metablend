// The press page (/press) and the press kit's README, English and German only (owner 2026-11-11): launch on
// 15 December 2026, the press release on 8 December. Checked against lib/wording.js in lib/press.test.js.
export const PRESS_KIT = '/press/metablend-press-kit.zip'

export const PRESS = {
  en: {
    title: 'Press',
    intro: 'MetaBlend is a free weather app that blends up to 20 weather sources into one forecast and shows how far they agree. Each source counts for more where it has been close lately, checked against weather stations, airport reports and feedback from people on the ground. For the mountains it adds summit forecasts, the best window for a summit and hiking routes timed against the weather.',
    factsTitle: 'Key facts',
    facts: [
      ['Sources', 'Up to 20 weather models and services, among them ECMWF, GFS, ICON, MET Norway and the NWS'],
      ['Languages', '13'],
      ['Platforms', 'The web at metablend.app, iPhone and Android'],
      ['Price', 'Free, no ads, no account'],
      ['Made by', 'One developer in Lienz, in the Austrian Alps'],
      ['Launch', '15 December 2026 on the App Store and Google Play'],
    ],
    contactTitle: 'Press contact',
    storesTitle: 'Get the app',
    storesSoon: 'On the App Store and Google Play from 15 December 2026. Until then MetaBlend runs in any browser at metablend.app.',
    kitTitle: 'Press kit',
    kitText: 'Everything in one ZIP file ({size}). Free to use when you report on MetaBlend.',
    kitButton: 'Download the press kit',
    kitItems: [
      'Logo: the wordmark and the MB mark, for light and dark backgrounds, as SVG and PNG',
      'App icon in Slate, as SVG and PNG',
      'Five screenshots each for the App Store and Google Play, in English',
      'Three screenshots without captions',
      'The Google Play feature graphic',
    ],
    previewDark: 'On dark',
    previewLight: 'On light',
    previewIcon: 'App icon',
  },
  de: {
    title: 'Presse',
    intro: 'MetaBlend ist eine kostenlose Wetter-App, die bis zu 20 Wetterquellen zu einer Vorhersage verbindet und zeigt, wie einig sie sich sind. Jede Quelle zählt dort mehr, wo sie zuletzt richtig lag, geprüft an Wetterstationen, Flughafenmeldungen und Rückmeldungen von Menschen vor Ort. Für die Berge kommen Gipfelprognosen, das beste Zeitfenster für einen Gipfel und Wanderrouten mit Zeitplan nach dem Wetter dazu.',
    factsTitle: 'Fakten',
    facts: [
      ['Quellen', 'Bis zu 20 Wettermodelle und Wetterdienste, darunter ECMWF, GFS, ICON, MET Norway und der NWS'],
      ['Sprachen', '13'],
      ['Plattformen', 'Im Web auf metablend.app, iPhone und Android'],
      ['Preis', 'Kostenlos, ohne Werbung, ohne Konto'],
      ['Entwicklung', 'Ein Entwickler in Lienz, in den österreichischen Alpen'],
      ['Start', '15. Dezember 2026 im App Store und bei Google Play'],
    ],
    contactTitle: 'Pressekontakt',
    storesTitle: 'Die App',
    storesSoon: 'Ab 15. Dezember 2026 im App Store und bei Google Play. Bis dahin läuft MetaBlend in jedem Browser auf metablend.app.',
    kitTitle: 'Pressemappe',
    kitText: 'Alles in einer ZIP-Datei ({size}). Frei verwendbar für Berichte über MetaBlend.',
    kitButton: 'Pressemappe herunterladen',
    kitItems: [
      'Logo: der Schriftzug und das MB-Zeichen, für helle und dunkle Hintergründe, als SVG und PNG',
      'App-Symbol in Slate, als SVG und PNG',
      'Je fünf Screenshots für den App Store und Google Play, auf Englisch',
      'Drei Screenshots ohne Beschriftung',
      'Die Feature-Grafik für Google Play',
    ],
    previewDark: 'Auf dunkel',
    previewLight: 'Auf hell',
    previewIcon: 'App-Symbol',
  },
}

export const pressFor = lang => PRESS[lang === 'de' ? 'de' : 'en']
