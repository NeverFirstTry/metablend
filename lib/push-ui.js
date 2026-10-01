// Small decisions behind the app's push UI (pure — unit tested).

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
