// The tester programme (/testers) and the in-app feedback link.
// Links are null until they exist; the page then says "opening soon" for
// that platform. Filling them in is a one-line change each:
// - androidGroup: the Google Group testers join (the Play closed test lists it)
// - androidOptIn: https://play.google.com/apps/testing/app.metablend
// - testflight:   the TestFlight public link
export const TESTERS = {
  androidGroup: null,
  androidOptIn: null,
  testflight: null,
}

export function channelOpen(links, platform) {
  return platform === 'ios' ? !!links.testflight : !!(links.androidGroup && links.androidOptIn)
}

export const TESTER_KEYS = [
  'testersTitle', 'testersIntro', 'testersAndroid', 'testersAndroidStep1', 'testersAndroidStep2', 'testersAndroidStep3',
  'testersJoinGroup', 'testersOptIn', 'testersIphone', 'testersIphoneStep', 'testersOpenTestflight', 'testersSoon',
  'testersStay', 'testersTryTitle', 'testersTry1', 'testersTry2', 'testersTry3', 'testersTry4', 'testersTry5',
  'testersFeedback', 'testersBecome', 'feedbackSend',
]

// "Android 14" / "iOS 17.5" from a user agent; '' for anything else.
export function osLabel(ua = '') {
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua)
  if (android) return `Android ${android[1]}`
  const ios = /(?:iPhone|CPU) OS (\d+)_(\d+)/.exec(ua)
  return ios ? `iOS ${ios[1]}.${ios[2]}` : ''
}

// An email to us with what we need to reproduce a report: platform, app
// version, OS and language. Nothing is sent until the user sends the mail.
export function feedbackMailto({ version = null, platform = 'web', os = '', lang = 'en' } = {}) {
  const where = [platform, version].filter(Boolean).join(' ')
  const subject = `MetaBlend feedback (${where}, ${lang})`
  const body = `\n\n\n—\n${[`MetaBlend ${version ?? 'web'}`, platform, os, lang].filter(Boolean).join(' · ')}`
  return `mailto:info@metablend.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
