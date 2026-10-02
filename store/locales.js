// App language → store locales (fastlane folder names). App Store Connect
// has no Slovenian listing, so Slovenian iPhone users see the English one.
export const LOCALES = [
  { lang: 'en', ios: 'en-US', android: 'en-US' },
  { lang: 'de', ios: 'de-DE', android: 'de-DE' },
  { lang: 'fr', ios: 'fr-FR', android: 'fr-FR' },
  { lang: 'es', ios: 'es-ES', android: 'es-ES' },
  { lang: 'it', ios: 'it', android: 'it-IT' },
  { lang: 'nl', ios: 'nl-NL', android: 'nl-NL' },
  { lang: 'pl', ios: 'pl', android: 'pl-PL' },
  { lang: 'cs', ios: 'cs', android: 'cs-CZ' },
  { lang: 'sl', ios: null, android: 'sl' },
  { lang: 'pt', ios: 'pt-BR', android: 'pt-BR' },
  { lang: 'ja', ios: 'ja', android: 'ja-JP' },
  { lang: 'zh', ios: 'zh-Hans', android: 'zh-CN' },
  { lang: 'ko', ios: 'ko', android: 'ko-KR' },
]
