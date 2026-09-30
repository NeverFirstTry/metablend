// Cookie-backed preferences shared by every page (language, unit, theme,
// recent cities). readCookie is pure for tests; get/setCookie touch document.
export function readCookie(cookieString, name) {
  const m = (cookieString ?? '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export function getCookie(name) {
  return typeof document === 'undefined' ? null : readCookie(document.cookie, name)
}

export function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}
