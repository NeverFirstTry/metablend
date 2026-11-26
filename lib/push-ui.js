// Small decisions behind the app's push UI (pure — unit tested).
import { cardWarnings } from './warnings/text.js'

// A tapped forecast notification needs a real page load: Home reads ?city=
// once when it mounts, so a client-side route to "/?city=…" would keep
// showing the last city. Other screens (a peak, More) route normally.
export const opensByReload = url => url === '/' || url.startsWith('/?')

// The "Get a heads-up before rain?" card: from the 3rd forecast view, until
// it's dismissed or notifications are turned on here; never when the phone
// blocks them or before there is a city to offer. "granted" alone isn't
// opting in — Android 12 and older report it without ever asking.
export function shouldPrompt({ views, dismissed, perm, optedIn, topCity }) {
  return views >= 3 && !dismissed && perm !== 'denied' && perm !== 'unavailable' && !optedIn && !!topCity
}

// enablePush's answer as the screens need it: 'done' only when the server took the phone (enablePush is ok only
// after /api/push/register answered 200), 'denied' when the phone's permission was refused, else 'error'
export const turnOnOutcome = r => (r?.ok ? 'done' : r?.reason === 'denied' ? 'denied' : 'error')

// What "Turn on" in the rain prompt saves: the open city as home and rain alerts on, nothing more. The prompt asks
// about rain; storm, severe weather and heat stay as they are (off on a new phone) until turned on in the settings
// (owner, 2026-11-22). The server's settings update is a patch: a flag left out keeps its value.
export const promptSettings = (city, lang, unit) => ({ home_name: city, alert_rain: true, lang, unit })

// The rain prompt waits while the warnings card lists an official warning for the place: the warning comes first, and
// below the card the prompt sat at the tab bar's edge (owner, 2026-11-22). It waits until the warnings are known too
// (useWarnings answers undefined while loading), so it does not show and then vanish; a failed request (null) or no
// place holds nothing back. warned: useWarnings' answer for the same place as the card.
export const promptWaits = (hasPlace, warned) =>
  hasPlace && (warned === undefined || (!!warned && cardWarnings(warned.warnings ?? [], warned.at).length > 0))
