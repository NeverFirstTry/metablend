'use client'

import { useLang } from '@/lib/useLang'
import { pageTitle, readerTitle, useDocTitle } from '@/lib/doc-title'

// The tab's title in the reader's language; the server's English title stays for search engines and English readers
// (lib/doc-title.js). k: the page's title key; vars: the places in it (a city, a peak and its height, an airport).
export default function DocTitle({ k, vars }) {
  const lang = useLang()
  useDocTitle(readerTitle(lang, pageTitle(lang, k, vars)))
  return null
}
