// The app's bottom tabs (app/components/AppChrome.jsx): which tab a page
// belongs to, and where a tab tap goes — back to where you were in that tab
// (the peak you had open, the city), or to its start when it's already open.
export const TAB_ROOTS = ['/', '/hike', '/more']

export function tabOf(pathname) {
  if (pathname === '/') return '/'
  return TAB_ROOTS.find(r => r !== '/' && (pathname === r || pathname?.startsWith(`${r}/`))) ?? null
}

export const tabHref = (root, lastByTab, activeRoot) => (root === activeRoot ? root : lastByTab[root] ?? root)

// Tapping the tab you're on, already at its start: back to the top, as iPhone
// tab bars do (the Forecast tab's start is the forecast on screen, whatever its
// ?city=). Anywhere deeper in the tab, the tap goes to its start (tabHref).
export const retapScrollsUp = (root, activeRoot, { pathname, search }) =>
  root === activeRoot && pathname === root && (root === '/' || !search)

// Where you were in a tab whose state lives in the URL (Hiking: the peak, the
// route), kept while the app runs. The Forecast tab keeps its screen in memory
// itself (lib/forecast-session.js); More has nothing to keep.
const LAST = {}
const URL_STATE_TABS = new Set(['/hike'])
export function rememberTabUrl(root, url) {
  if (URL_STATE_TABS.has(root)) LAST[root] = url
}
export const lastTabUrls = () => LAST
