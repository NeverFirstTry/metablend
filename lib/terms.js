// The terms notice on the app's first start (2026-11-10): "By using MetaBlend you accept the Terms of
// Use", with the privacy notice linked as information (its basis is legitimate interest, nobody
// agrees to it), and one button. Passed once, the phone keeps the version of the terms it was passed
// for; when the terms change in substance, TERMS_VERSION changes and the notice comes once more,
// saying so. Pure: the boot script (lib/app-client.js), the notice and the capture scripts share it.

// The day the German terms last changed in substance (the liability section). Change it together
// with the terms and every phone shows the notice again; a typo fix does not need it.
export const TERMS_VERSION = '2026-11-09'

// Where the phone keeps the version it passed the notice for: localStorage, so it never reaches the
// server (the privacy notice names it under "What stays on your device").
export const TERMS_KEY = 'metablend_terms'

// The pages the notice never covers: they are what it links to, and the imprint.
export const TERMS_OPEN_PATHS = /^\/(terms|privacy|impressum)(\/|$)/

// Does this page wait behind the notice? `stored` is what the phone kept, null on a first start.
export const termsDue = (stored, path) => stored !== TERMS_VERSION && !TERMS_OPEN_PATHS.test(path ?? '/')

// An earlier version was passed: the notice then says that the terms have changed.
export const termsChanged = stored => !!stored && stored !== TERMS_VERSION

// Storage can be switched off or full: reading then gives null and keeping gives false, and the notice
// counts as passed for this start only (TermsNotice keeps that in memory).
export function passedVersion(storage) {
  try { return storage.getItem(TERMS_KEY) } catch { return null }
}
export function keepPassed(storage) {
  try { storage.setItem(TERMS_KEY, TERMS_VERSION); return true } catch { return false }
}

// For the capture scripts (layout check, accessibility check, store screenshots): a page script
// that marks the notice as passed before the page's own scripts run, so they see the app and not the
// notice. A URL with terms=show gets the notice instead: that is how they look at the notice itself.
export const TERMS_CAPTURE_SCRIPT = `try{if(/[?&]terms=show(&|$)/.test(location.search))localStorage.removeItem('${TERMS_KEY}');else localStorage.setItem('${TERMS_KEY}','${TERMS_VERSION}')}catch(e){}`

// A sentence with its link marked in square brackets, as the language packs write it:
// "… you accept the [Terms of Use]." gives ['… you accept the ', 'Terms of Use', '.'].
export function linkedParts(text) {
  const m = /^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/.exec(text ?? '')
  return m ? [m[1], m[2], m[3]] : [text ?? '', '', '']
}
