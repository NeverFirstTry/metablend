// Which region Rankings opens on: the visitor's own, from the browser's time zone, so it
// needs no permission and no request. Europe when the zone says nothing.
const SOUTH_AMERICA = /^America\/(Argentina\/|Araguaina|Asuncion|Bahia|Belem|Boa_Vista|Bogota|Buenos_Aires|Campo_Grande|Caracas|Cayenne|Cuiaba|Eirunepe|Fortaleza|Guayaquil|Guyana|La_Paz|Lima|Maceio|Manaus|Montevideo|Noronha|Paramaribo|Porto_Velho|Punta_Arenas|Recife|Rio_Branco|Santarem|Santiago|Sao_Paulo)/

export function regionFromTimeZone(zone) {
  if (typeof zone !== 'string') return 'europe'
  if (SOUTH_AMERICA.test(zone)) return 'south_america'
  const [area] = zone.split('/')
  return { America: 'north_america', Africa: 'africa', Asia: 'asia', Indian: 'asia', Australia: 'oceania', Pacific: 'oceania' }[area] ?? 'europe'
}

export function visitorRegion() {
  try { return regionFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) } catch { return 'europe' }
}
