// The start page's search block (UX review S6; Review, 2026-11-22). In the app a returning user's search folds away
// behind the place's name, which then opens it. Everywhere else the search is always in view, so the name stays
// plain text and nothing announces "collapsed" over a search that is on screen.

// read from <html>'s marks after mount: the boot script sets data-app and, for a place to start at, data-returning
export const searchFolds = dataset => dataset?.app === '1' && dataset?.returning !== undefined

// open after a tap on the name, with an error to read, or in compare (which needs the field)
export const searchBlockOpen = ({ tapped, error, compare }) => !!(tapped || error || compare)
