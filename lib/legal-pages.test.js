// The legal pages rendered for real, in every language (JSX and the app's imports: lib/test-jsx-hooks.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { LANGUAGES } = await import('./i18n.js')
const { TermsBody } = await import('../app/terms/content.jsx')
const { PrivacyBody } = await import('../app/privacy/content.jsx')
const { default: Impressum, metadata } = await import('../app/impressum/page.js')

const CODES = LANGUAGES.map(l => l.code)
const plain = html => html.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&nbsp;', ' ')
const paragraphs = html => [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].map(m => plain(m[1]))
const headings = html => [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map(m => plain(m[1]))
const section = (html, title) => {
  const parts = html.split('<section')
  const hit = parts.find(p => plain(p.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1] ?? '') === title)
  assert.ok(hit, `no section "${title}" among ${headings(html).join(' | ')}`)
  return hit
}

// the owner's German original, word for word
const HAFTUNG = [
  'MetaBlend fasst Wettervorhersagen verschiedener Quellen automatisiert zusammen. Vorhersagen sind Wahrscheinlichkeitsaussagen aus Wettermodellen und Messstationen und können danebenliegen. Die angezeigten Daten, Gipfelprognosen, Zeitfenster, Startzeiten und Warnungen sind unverbindliche Informationen ohne Gewähr für Richtigkeit, Vollständigkeit oder Aktualität. Datenquellen können ausfallen, verzögert oder fehlerhaft sein.',
  'MetaBlend ist eine Planungshilfe. Es ersetzt keine amtlichen Warnungen (GeoSphere Austria und die nationalen Wetterdienste), keinen Lawinenlagebericht und keine eigene Beurteilung der Verhältnisse vor Ort. Planung und Durchführung von Touren und sonstigen Aktivitäten erfolgen in eigener Verantwortung. Brechen Sie eine Tour ab, wenn die Bedingungen vor Ort von der Vorhersage abweichen. Im Notfall: Bergrettung 140, Euronotruf 112.',
  'Die Aviation-Seiten dienen nicht der Flugvorbereitung. Holen Sie vor jedem Flug das amtliche Flugwetter-Briefing ein, in Österreich bei Austro Control. Prüfen Sie im Winter vor jeder Gipfel- oder Routenplanung den Lawinenlagebericht Ihrer Region, für Tirol zum Beispiel lawinen.report.',
  'Die Nutzung von MetaBlend ist kostenlos. Für Schäden aus der Nutzung oder Nichtverfügbarkeit der Informationen haftet der Betreiber nicht, soweit sie leicht fahrlässig verursacht wurden. Nicht ausgeschlossen ist die Haftung für Vorsatz und grobe Fahrlässigkeit sowie für schuldhaft verursachte Schäden an Leben, Körper oder Gesundheit (§ 6 Abs. 1 Z 9 KSchG). Eine ununterbrochene Verfügbarkeit des Dienstes wird nicht zugesagt.',
  'Für Inhalte externer Links und Datenquellen sind ausschließlich deren Betreiber verantwortlich.',
]

test('/terms renders its own text in all 13 languages, disclaimer first, with the emergency numbers', () => {
  const en = render(h(TermsBody, { lang: 'en' }))
  assert.equal(CODES.length, 13)
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    assert.equal(headings(html).length, headings(en).length, `${lang}: sections`)
    assert.match(html.split('<section')[1], /^ id="disclaimer"/, `${lang}: the disclaimer comes first`)
    if (lang !== 'en') {
      assert.notEqual(plain(section(html, headings(html)[0])), plain(section(en, headings(en)[0])), `${lang}: disclaimer falls back to English`)
      const rest = h => plain(h.split('<section').slice(2).join(''))
      assert.notEqual(rest(html), rest(en), `${lang}: terms fall back to English`)
    }
    const disclaimer = paragraphs(section(html, headings(html)[0]))
    assert.equal(disclaimer.length, 5, `${lang}: disclaimer paragraphs`)
    assert.match(disclaimer[1], /140[^]*112/, `${lang}: emergency numbers`)
    assert.match(disclaimer[1], /GeoSphere Austria/, `${lang}: official services`)
    assert.match(disclaimer[2], /Austro Control/, `${lang}: the aviation briefing`)
    assert.match(disclaimer[2], /lawinen\.report/, `${lang}: the avalanche report`)
  }
})

test('/terms German: the liability text is the original, word for word', () => {
  const html = render(h(TermsBody, { lang: 'de' }))
  assert.deepEqual(paragraphs(section(html, 'Haftungsausschluss')), HAFTUNG)
})

// the exclusion covers slight negligence only; "leicht fahrlässig", "Nicht ausgeschlossen" and "schuldhaft" stay clear in every language
const TERMS = {
  de: ['leicht fahrlässig', 'Nicht ausgeschlossen ist die Haftung', 'schuldhaft'],
  en: ['slight negligence', 'Not excluded is liability', 'culpably'],
  fr: ['négligence légère', 'N’est pas exclue la responsabilité', 'de manière fautive'],
  es: ['negligencia leve', 'No queda excluida la responsabilidad', 'de forma culpable'],
  it: ['colpa lieve', 'Non è esclusa la responsabilità', 'in modo colpevole'],
  nl: ['lichte nalatigheid', 'Niet uitgesloten is de aansprakelijkheid', 'verwijtbaar'],
  pl: ['lekkim niedbalstwem', 'Nie jest wyłączona odpowiedzialność', 'w sposób zawiniony'],
  cs: ['lehkou nedbalostí', 'Vyloučena není odpovědnost', 'zaviněně'],
  sl: ['lahke malomarnosti', 'Ni izključena odgovornost', 'krivdno'],
  pt: ['culpa leve', 'Não fica excluída a responsabilidade', 'de forma culpável'],
  ja: ['軽過失', '排除されません', '有責に'],
  zh: ['轻微过失', '不排除', '过错'],
  ko: ['경과실', '배제되지 않습니다', '유책하게'],
}
// what stays outside the exclusion: intent, gross negligence, injury to life, body or health; then the availability sentence
const EXCEPTIONS = {
  de: ['Vorsatz', 'grobe Fahrlässigkeit', 'Leben, Körper oder Gesundheit', 'Eine ununterbrochene Verfügbarkeit des Dienstes wird nicht zugesagt.'],
  en: ['intent', 'gross negligence', 'life, body or health', 'Uninterrupted availability of the service is not promised.'],
  fr: ['faute intentionnelle', 'négligence grave', 'à la vie, au corps ou à la santé', 'Une disponibilité ininterrompue du service n’est pas garantie.'],
  es: ['dolo', 'negligencia grave', 'la vida, la integridad física o la salud', 'No se garantiza una disponibilidad ininterrumpida del servicio.'],
  it: ['dolo', 'colpa grave', 'alla vita, al corpo o alla salute', 'Non viene garantita una disponibilità ininterrotta del servizio.'],
  nl: ['opzet', 'grove nalatigheid', 'leven, lichaam of gezondheid', 'Een ononderbroken beschikbaarheid van de dienst wordt niet toegezegd.'],
  pl: ['winę umyślną', 'rażące niedbalstwo', 'życiu, ciele lub zdrowiu', 'Nieprzerwana dostępność usługi nie jest gwarantowana.'],
  cs: ['úmysl', 'hrubou nedbalost', 'životě, těle nebo zdraví', 'Nepřetržitá dostupnost služby není přislíbena.'],
  sl: ['naklep', 'hudo malomarnost', 'življenju, telesu ali zdravju', 'Neprekinjena razpoložljivost storitve ni zagotovljena.'],
  pt: ['dolo', 'culpa grave', 'à vida, ao corpo ou à saúde', 'Não se garante uma disponibilidade ininterrupta do serviço.'],
  ja: ['故意', '重大な過失', '生命、身体または健康', 'サービスを中断なく提供することは保証されません。'],
  zh: ['故意', '重大过失', '生命、身体或健康', '不保证服务不间断可用。'],
  ko: ['고의', '중대한 과실', '생명, 신체 또는 건강', '서비스의 중단 없는 이용 가능성은 보장되지 않습니다.'],
}

test('/terms: no translation of the liability paragraph is wider than the German: all three exceptions in the not-excluded sentence, none in the exclusion, the availability sentence last', () => {
  assert.deepEqual(Object.keys(EXCEPTIONS).sort(), [...CODES].sort())
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    const liability = paragraphs(section(html, headings(html)[0]))[3]
    const [slight, notExcluded] = TERMS[lang]
    const [intent, gross, injury, availability] = EXCEPTIONS[lang]
    const [before, after, ...more] = liability.split('§ 6 Abs. 1 Z 9 KSchG')
    assert.equal(more.length, 0, `${lang}: the citation stands once`)
    // before the citation: free of charge, the exclusion, the exceptions
    const sentences = before.split(/(?<=[.。])\s*/)
    assert.equal(sentences.length, 3, `${lang}: three sentences before the citation, got ${sentences.length}`)
    const [, exclusion, exceptions] = sentences
    assert.ok(exclusion.includes(slight), `${lang}: the exclusion names "${slight}"`)
    for (const phrase of [notExcluded, intent, gross, injury]) {
      assert.ok(exceptions.includes(phrase), `${lang}: "${phrase}" in the not-excluded sentence`)
      assert.ok(!exclusion.includes(phrase), `${lang}: "${phrase}" in the exclusion`)
    }
    assert.equal(after.replace(/^[)）][.。]\s*/, ''), availability, `${lang}: the availability sentence closes the paragraph`)
  }
})

test('/terms: the blanket "not liable for any loss" sentences are gone, the limited exclusion stands alone', () => {
  const de = plain(render(h(TermsBody, { lang: 'de' })))
  assert.doesNotMatch(de, /Wir haften nicht für/)
  const en = plain(render(h(TermsBody, { lang: 'en' })))
  assert.doesNotMatch(en, /not liable for any loss/)
  assert.doesNotMatch(en, /fully|under all circumstances/)
  // the earlier wording, gone everywhere
  const OLD = /gesetzlich zulässigen Ausmaß|extent permitted by law|mesure permise par la loi|medida permitida por la ley|misura consentita dalla legge|voor zover wettelijk toegestaan|zakresie dozwolonym przez prawo|rozsahu povoleném zákonem|obsegu, ki ga dopušča zakon|medida permitida por lei|法律で認められる範囲|在法律允许的范围内|법률이 허용하는 범위/
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    const liability = paragraphs(section(html, headings(html)[0]))[3]
    for (const phrase of TERMS[lang]) assert.ok(liability.includes(phrase), `${lang}: ${phrase}`)
    assert.doesNotMatch(liability, OLD, lang)
  }
})

// German first (owner's brief, 2026-11-10): using the website is accepting the terms, the app asks once with its button
const ANNAHME = 'Mit der Nutzung der Website akzeptieren Sie diese Nutzungsbedingungen. In der App akzeptieren Sie sie einmal beim ersten Start mit „Weiter“.'
const SICHERHEIT = 'Verlassen Sie sich nicht auf MetaBlend, wenn Wettergenauigkeit sicherheitsrelevant ist: Luftfahrt, Seefahrt, Wandern, Bergsteigen, Skitouren, Unwetter, Medizin oder Ähnliches. Ziehen Sie immer einen offiziellen Wetterdienst zurate. Prüfen Sie für Bergtouren und zur Lawinengefahr immer den offiziellen Bergwetterbericht und den offiziellen Lawinenlagebericht der Region (Lawinenwarndienst). Die Aviation-Seiten (/aviation) sind reine Zusatzinformation: niemals für Flugplanung oder Navigation verwenden; holen Sie immer ein offizielles Preflight-Briefing ein.'
const sectionBody = part => plain(part.split('</section>')[0].match(/<div[^>]*>(.*)<\/div>/s)?.[1] ?? '')

test('/terms: near the start, using the website is accepting the terms and the app asks once with its button, in all 13 languages', async () => {
  const { loadLanguage, t } = await import('./i18n.js')
  const seen = new Set()
  for (const lang of CODES) {
    await loadLanguage(lang)
    const accept = paragraphs(render(h(TermsBody, { lang })).split('<section')[0]).at(-1)
    if (lang === 'de') assert.equal(accept, ANNAHME)
    assert.ok(accept.includes(t(lang, 'termsNoticeContinue')), `${lang}: the app's button by its own word: ${accept}`)
    seen.add(accept)
  }
  assert.equal(seen.size, 13, 'every language has its own sentence')
})

test('/terms: the safety section names the mountain sports and points to the official mountain forecast and avalanche bulletin; German word for word', () => {
  assert.equal(sectionBody(section(render(h(TermsBody, { lang: 'de' })), 'Nicht für sicherheitskritische Zwecke')), SICHERHEIT)
  const BULLETIN = { en: 'official avalanche bulletin', de: 'offiziellen Lawinenlagebericht', fr: 'bulletin d’avalanche officiel', es: 'boletín oficial de aludes', it: 'bollettino valanghe ufficiale', nl: 'officiële lawinebericht',
    pl: 'oficjalny komunikat lawinowy', cs: 'oficiální lavinovou zprávu', sl: 'uradni lavinski bilten', pt: 'boletim oficial de avalanches', ja: '公式の雪崩情報', zh: '官方雪崩公报', ko: '공식 눈사태 정보' }
  for (const lang of CODES) {
    const part = render(h(TermsBody, { lang })).split('<section')[3] // the disclaimer, the beta section, then this one
    assert.ok(sectionBody(part).includes(BULLETIN[lang]), `${lang}: ${BULLETIN[lang]}`)
    assert.match(part, /href="\/aviation"/, `${lang}: the aviation sentence is still there`)
  }
})

test('/terms: every credit line stands in its provider’s words in all 13 languages; what stands around it is in the page’s language', () => {
  const CREDITS = ['“Weather data by Open-Meteo.com”',
    'This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). Source: www.ecmwf.int. Licence: CC BY 4.0.',
    'ALADIN model forecasts. Source: Czech Hydrometeorological Institute (ČHMÚ), www.chmi.cz. Licence: CC BY 4.0.',
    '“Data from MET Norway”', 'Weather data © OpenWeather (ODbL) · Powered by WeatherAPI.com · Weather data provided by Visual Crossing Weather',
    '“Weather information displayed here is provided for general informational purposes only.', 'Always consult official meteorological services and relevant authorities for decisions where accuracy is critical.”',
    'Datenbasis: Deutscher Wetterdienst, eigene Bearbeitung: mit anderen Quellen gemittelt', 'Radar: Weather data by RainViewer', 'Source: Meteostat, Deutscher Wetterdienst (CC BY 4.0)',
    '© OpenStreetMap contributors (ODbL)', 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)', '© OpenStreetMap contributors, Overture Maps Foundation (ODbL)', 'GeoNames (CC BY 4.0)']
  const list = lang => plain(render(h(TermsBody, { lang })).match(/<ul[^>]*>(.*?)<\/ul>/s)[1])
  const en = list('en')
  for (const lang of CODES) {
    const text = list(lang)
    for (const credit of CREDITS) assert.ok(text.includes(credit), `${lang}: ${credit}`)
    if (lang !== 'en') for (const words of ['blended with other sources', 'the rain radar map', 'towns for the hiking search', 'route maps in the app', 'model feeds']) assert.ok(en.includes(words) && !text.includes(words), `${lang}: "${words}" is English`)
  }
  assert.ok(list('de').includes('GeoSphere Austria (CC BY 4.0): mit anderen Quellen gemittelt, daher gegenüber dem Original verändert'))
  assert.ok(list('de').includes('Radar: Weather data by RainViewer: die Regenradarkarte'))
})

test('no legal page shows an em or en dash in any of the 13 languages: terms, privacy, support and the imprint', async () => {
  const { loadLanguage } = await import('./i18n.js')
  const { SupportBody } = await import('../app/support/SupportContent.jsx')
  const clean = (name, html) => { const text = plain(html), at = text.search(/[—–]/); assert.equal(at, -1, `${name}: “${text.slice(Math.max(0, at - 40), at + 40)}”`) }
  for (const lang of CODES) {
    await loadLanguage(lang)
    for (const [name, Body] of [['terms', TermsBody], ['privacy', PrivacyBody], ['support', SupportBody]]) clean(`${lang} ${name}`, render(h(Body, { lang })))
  }
  clean('imprint', render(h(Impressum)))
})

// the owner's German original (2026-11-10): what the LICENSE file grants, in the terms' own words
const URHEBERRECHT ='© 2026 Rene Kostmann. Der Quellcode ist auf GitHub veröffentlicht und steht unter der Functional Source License 1.1 mit Apache 2.0 als späterer Lizenz (FSL-1.1-ALv2): Er darf für jeden Zweck genutzt, verändert und weitergegeben werden, außer für ein kommerzielles Angebot, das mit MetaBlend konkurriert. Zwei Jahre nach ihrer Veröffentlichung steht jede Version zusätzlich unter der Apache-Lizenz 2.0. Name und Logo von MetaBlend sind von der Lizenz nicht erfasst und bleiben Eigentum ihres Urhebers.'

// what the footer and the terms said until 2026-11-10, in the 13 languages
const ALL_RIGHTS = ['All rights reserved', 'Alle Rechte vorbehalten', 'Tous droits réservés', 'Todos los derechos reservados', 'Tutti i diritti riservati', 'Alle rechten voorbehouden',
  'Wszelkie prawa zastrzeżone', 'Všechna práva vyhrazena', 'Vse pravice pridržane', 'Todos os direitos reservados', '無断転載を禁じます', '保留所有权利', '모든 권리 보유']

test('/terms: the copyright section names the licence of the LICENSE file in all 13 languages; the German is the original, word for word', () => {
  const body = part => plain(part.match(/<div[^>]*>(.*)<\/div>/s)?.[1] ?? '')
  assert.equal(body(section(render(h(TermsBody, { lang: 'de' })), 'Urheberrecht')), URHEBERRECHT)
  const licence = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8')
  assert.ok(licence.includes('Functional Source License, Version 1.1, ALv2 Future License') && licence.includes('Copyright 2026 Rene Kostmann'), 'the LICENSE file the section speaks of')
  const texts = new Set()
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    const part = html.split('<section').find(p => p.includes('FSL-1.1-ALv2'))
    assert.ok(part, `${lang}: no section names FSL-1.1-ALv2`)
    const text = body(part.split('</section>')[0])
    for (const phrase of ['© 2026 Rene Kostmann', 'Functional Source License 1.1', 'Apache 2.0', 'MetaBlend']) assert.ok(text.includes(phrase), `${lang}: ${phrase}`)
    assert.match(part, /href="https:\/\/github\.com\/NeverFirstTry\/metablend"/, `${lang}: the code is linked`)
    // the licence is source-available, never "open source"
    assert.doesNotMatch(text, /open[ -]source/i, lang)
    // the footer's copyright line is the LICENSE file's and leads to this section
    assert.match(part, /^ id="copyright"/, `${lang}: the section the footer links to`)
    assert.match(html, /<footer[^]*<a [^>]*href="\/terms#copyright"[^>]*>© 2026 Rene Kostmann<\/a>/, `${lang}: the footer's line`)
    // neither the section nor the footer says the opposite any more
    for (const old of ALL_RIGHTS) assert.ok(!plain(html).toLowerCase().includes(old.toLowerCase()), `${lang}: "${old}"`)
    texts.add(text)
  }
  assert.equal(texts.size, 13, 'every language has its own sentence')
})

test('/privacy renders its own text in all 13 languages: controller with address, hosting, rights, the email paragraph', () => {
  const en = render(h(PrivacyBody, { lang: 'en' }))
  const DPA = {
    en: 'A data processing agreement is in place with Vercel.', de: 'Mit Vercel besteht ein Auftragsverarbeitungsvertrag.',
    fr: 'Un contrat de sous-traitance est conclu avec Vercel.', es: 'Existe un contrato de encargo del tratamiento con Vercel.',
    it: 'Con Vercel è in essere un accordo sul trattamento dei dati.', nl: 'Met Vercel is een verwerkersovereenkomst gesloten.',
    pl: 'Z Vercel zawarta jest umowa powierzenia przetwarzania danych.', cs: 'S Vercel je uzavřena smlouva o zpracování osobních údajů.',
    sl: 'Z Vercel je sklenjena pogodba o obdelavi osebnih podatkov.', pt: 'Existe um contrato de tratamento de dados com a Vercel.',
    ja: 'Vercelとはデータ処理契約を締結しています。', zh: '我们已与 Vercel 签订数据处理协议。', ko: 'Vercel과 데이터 처리 계약을 체결했습니다.',
  }
  for (const lang of CODES) {
    const html = render(h(PrivacyBody, { lang }))
    const text = plain(html)
    assert.equal(headings(html).length, headings(en).length, `${lang}: sections`)
    assert.ok(text.includes(DPA[lang]), `${lang}: data processing agreement`)
    assert.match(text, /Rene Kostmann, Siedlerstraße 19, 9900 Lienz/, `${lang}: controller`)
    assert.match(text, /440 N Barranca Ave #4133, Covina, CA 91723/, `${lang}: Vercel's address`)
    assert.match(text, /Barichgasse 40-42, 1030 Wien, www\.dsb\.gv\.at/, `${lang}: complaints`)
    assert.match(text, /ImprovMX[^.]*Minimum[^.]*7/, `${lang}: ImprovMX keeps only basic mail metadata (log level Minimum) for 7 days`)
    assert.match(text, /WeatherAPI[^;]{0,120}\b28\b/, `${lang}: WeatherAPI named as a processor (Art. 28) for the coordinates we send`)
    for (const service of ['Supabase', 'Plausible', 'Speed Insights', 'Web Analytics', 'Open-Meteo', 'Photon', 'OpenStreetMap', 'OpenTopoMap', 'Meteostat', 'RainViewer', 'APNs', 'FCM', 'ImprovMX', 'Gmail']) {
      assert.ok(text.includes(service), `${lang}: ${service} still named`)
    }
    if (lang !== 'en') assert.notEqual(text, plain(en), `${lang}: falls back to English`)
  }
})

// 2026-11-09: "My location" asks our own server with a rounded position and Leaflet is our own copy,
// so BigDataCloud and unpkg are gone from the site and from the notice; what the notice said too
// roughly is now exact (the app's cookie, how long forecasts live, the 5 km cell, what loads directly).
test('/privacy in all 13 languages: no BigDataCloud or unpkg; the app cookie for 30 days; forecasts up to 72 hours; positions rounded to 10 and to 5 km; tiles and radar seen with the IP address; a typed place search stays with our own server (2026-11-12)', () => {
  for (const lang of CODES) {
    const html = render(h(PrivacyBody, { lang }))
    const sections = html.split('<section').slice(1).map(plain)
    for (const gone of ['BigDataCloud', 'unpkg']) assert.ok(!sections.some(s => s.includes(gone)), `${lang}: ${gone} is gone`)
    assert.match(sections[1], /metablend_app[^]*30/, `${lang}: the app cookie and its 30 days, with what stays on the device`)
    const kept = sections.filter(s => /(?<!\d)72(?!\d)/.test(s)) // not the 91723 of Vercel's address
    assert.equal(kept.length, 1, `${lang}: one section says 72 hours`)
    assert.doesNotMatch(kept[0], /(?<!\d)48(?!\d)/, `${lang}: the 48 hours are gone`)
    assert.doesNotMatch(kept[0], /[—–]/, `${lang}: no dash left in the retention paragraph`)
    const third = sections.find(s => s.includes('RainViewer'))
    assert.match(third, /(?<!\d)10\s?(?:km|公里)/, `${lang}: 10 km`)
    assert.match(third, /(?<!\d)5\s?(?:km|公里)/, `${lang}: the 5 km cell of the summit list`)
    assert.ok(third.split('IP').length - 1 >= 3, `${lang}: the map tiles and RainViewer see the IP address, and the Open-Meteo line says that it does not`)
    assert.ok(third.includes('GeoNames'), `${lang}: the place search is answered by our own server from our own list of towns (GeoNames named)`)
  }
})

test('/privacy German: the location and direct-load sentences, word for word', () => {
  const text = plain(render(h(PrivacyBody, { lang: 'de' })))
  for (const sentence of [
    'In der App kommt das Cookie „metablend_app“ hinzu. Es hält 30 Tage lang fest, dass die Seiten in der App geöffnet sind, damit sie im App-Layout erscheinen, und erreicht wie die anderen Cookies unseren Server, der es nicht speichert.',
    'Gespeicherte Vorhersagen und interne Verwaltungseinträge werden von einem täglichen Aufräumjob automatisch gelöscht (nach bis zu 72 Stunden); Konsens-Snapshots nach 7 Tagen, Server-Fehlerprotokolle nach 14 Tagen. Community-Feedback bleibt länger erhalten, bis Sie um Löschung bitten (siehe unten): Es speist die öffentliche Heatmap und die langfristigen Ranglisten. Aggregierte Genauigkeitsgewichte sind anonym und werden unbegrenzt aufbewahrt.',
    'Für eine Vorhersage senden wir die Koordinaten des gesuchten Ortes an Wetteranbieter, für die Gipfelsuche und „Mein Standort“ in den unten genannten Fällen auch Angaben an Geocoding-Anbieter, und erhalten deren Daten zurück:',
    'Open-Meteo (inkl. Luftqualität, historisches Archiv): erhält von unserem Server die Koordinaten des Ortes. Ihr Browser ruft Open-Meteo nicht direkt auf; Open-Meteo sieht daher weder Ihre IP-Adresse noch den eingegebenen Text',
    'Photon (komoot), OpenStreetMap und Overpass (overpass-api.de, private.coffee) für Gipfelsuche und Gipfelhöhen: der Suchtext und bei „In meiner Nähe“ ein gerundeter Standort (für die Suche auf etwa 10 km, für die Gipfelliste in Ihrer Nähe auf etwa 5 km); für markierte Routen sendet unser Server nur die Koordinaten des Gipfels. Bei „Mein Standort“ fragt unser Server OpenStreetMap nur dann nach dem Ortsnamen, wenn unsere eigene Ortsliste keinen Ort in der Nähe kennt, und nur mit der auf etwa 10 km gerundeten Position',
    'Kartenkacheln von OpenStreetMap-Mitwirkenden (Heatmap und Regenradar) und OpenTopoMap (Routenkarten in der App): Ihr Browser lädt sie direkt von deren Servern, sobald sich eine Karte öffnet; sie sehen daher Ihre IP-Adresse und den Kartenausschnitt',
    'Unser eigener Server: bei der Ortssuche für die Vorhersage der Text, den Sie in das Suchfeld tippen. Der Server liefert daraus die Suchvorschläge und den gesuchten Ort aus unserer eigenen Ortsliste (Ortsnamen von GeoNames); an einen Geocoding-Anbieter geht dieser Text nicht. Bei „Mein Standort“ Ihre auf etwa 10 km gerundete Position. Er bestimmt daraus den Ort, in der Regel aus unserer eigenen Ortsliste, und Ihr Gerät merkt sich die gerundete Position für diesen Ort. Bei „In meiner Nähe“ erhält er Ihre Position auf etwa 10 km gerundet für die Gipfelsuche und auf etwa 5 km gerundet für die Gipfelliste in Ihrer Nähe. Die genaue Position Ihres Geräts verlässt das Gerät dabei nicht',
    'RainViewer (Regenradar): Ihr Browser lädt das Radar direkt von RainViewer, sobald sich die Radarkarte öffnet; RainViewer sieht daher Ihre IP-Adresse und den Kartenausschnitt',
  ]) assert.ok(text.includes(sentence), sentence.slice(0, 70))
})

test('/privacy German: the supplied sections, word for word', () => {
  const html = render(h(PrivacyBody, { lang: 'de' }))
  assert.equal(plain(section(html, 'Verantwortlicher').replace(/^[^]*?<\/h2>/, '').trim()), 'Rene Kostmann, Siedlerstraße 19, 9900 Lienz, Österreich\nE-Mail: info@metablend.app')
  const hosting = plain(section(html, 'Hosting und Server-Logfiles').replace(/^[^]*?<\/h2>/, ''))
  assert.equal(hosting, 'Diese Website wird bei Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Daten: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser- und Betriebssysteminformationen sowie die zuvor besuchte Seite. Das dient dem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse). Die Logfiles werden nur für begrenzte Zeit gespeichert und danach gelöscht. Mit Vercel besteht ein Auftragsverarbeitungsvertrag. Vercel ist nach dem EU-US Data Privacy Framework zertifiziert; die Übermittlung in die USA erfolgt auf Grundlage des Angemessenheitsbeschlusses der EU-Kommission (Art. 45 DSGVO).')
  assert.ok(paragraphs(section(html, 'Kontakt')).includes('Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer Nachricht, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO). Die Daten werden gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten bestehen.'))
  assert.ok(paragraphs(section(html, 'Ihre Rechte und Möglichkeiten')).includes('Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Schreiben Sie dazu an info@metablend.app. Sie können sich außerdem bei der Österreichischen Datenschutzbehörde beschweren (Barichgasse 40-42, 1030 Wien, www.dsb.gv.at).'))
})

test('German /privacy and /terms address the reader as "Sie" throughout, like the legal texts', () => {
  for (const Body of [PrivacyBody, TermsBody]) {
    const main = plain(render(h(Body, { lang: 'de' })).split('<footer')[0])
    assert.doesNotMatch(main, /\b(du|dein\w*|dir|dich)\b/i)
  }
})

test('the translated /privacy and /terms address the reader formally too, like their legal paragraphs', () => {
  const word = list => new RegExp(`(?<!\\p{L})(?:${list})(?!\\p{L})`, 'iu')
  const INFORMAL = {
    es: word('tu|tus|puedes|quieres|usas|buscas|envías|informas|activas|planificas|pides|pidas|te apuntas|escribe|abre|confíes|consulta siempre|uses|obtén|abuses'),
    it: word('ti|tu|tuo|tua|tuoi|tue|puoi|vuoi|se usi|se attivi|invii|segnali|pianifichi|inserisci|compili|chiedi|scrivi|apri|affidarti|consulta sempre|usarle|ottieni|favore non abusare'),
    nl: word('je|jij|jou|jouw|alsjeblieft'),
    pl: word('cię|twój|twoja|twoje|twojego|twojej|twoim|twoją|możesz|używasz|wysyłasz|zgłaszasz|planujesz|poprosisz|włączysz|zapiszesz|wypełnisz|napisz|polegaj|korzystaj|używaj|uzyskaj|zgłoś'),
    sl: word('tvoj\\p{L}*|izbrišeš|pošlješ|sporočiš|uporabiš|uporabljaš|vklopiš|načrtuješ|prijaviš|vpišeš|prosiš|zahtevaš|piši|odpri|zanašaj|posvetuj|uporabljaj|pridobi|zlorabljaj'),
    zh: /你/u,
    ko: /(?<!필|중)요(?!\p{L})/u, // the polite "-요" ending, not 필요 or 중요
  }
  for (const [lang, informal] of Object.entries(INFORMAL)) {
    for (const Body of [PrivacyBody, TermsBody]) {
      assert.doesNotMatch(plain(render(h(Body, { lang })).split('<footer')[0]), informal, `${lang}: ${Body.name}`)
    }
  }
})

test('/privacy: every translation opens with the note that German, the legal original, applies; the German page has none', () => {
  const NOTE = {
    en: 'the German version applies', fr: 'la version allemande prévaut', es: 'prevalece la versión alemana', it: 'prevale la versione tedesca',
    nl: 'geldt de Duitse versie', pl: 'obowiązuje wersja niemiecka', cs: 'platí německá verze', sl: 'velja nemška različica',
    pt: 'vale a versão em alemão', ja: 'ドイツ語版が優先', zh: '以德文版为准', ko: '독일어 원문이 우선',
  }
  const translations = CODES.filter(c => c !== 'de')
  assert.deepEqual(Object.keys(NOTE).sort(), [...translations].sort())
  const note = html => plain(html.match(/<em[^>]*>(.*?)<\/em>/s)?.[1] ?? '')
  assert.equal(note(render(h(PrivacyBody, { lang: 'de' }))), '')
  for (const lang of translations) {
    const html = render(h(PrivacyBody, { lang }))
    assert.ok(note(html).includes(NOTE[lang]), `${lang}: note`)
    assert.doesNotMatch(plain(html), /Engelse versie|wersja angielska|anglická verze|angleška različica|versão em inglês|英語版|英文版|영어 원문/, lang)
  }
})

test('/terms: every translation opens with the same note as /privacy; the German page and /impressum have none', () => {
  const note = html => plain(html.match(/<em[^>]*>(.*?)<\/em>/s)?.[1] ?? '')
  assert.equal(note(render(h(TermsBody, { lang: 'de' }))), '')
  for (const lang of CODES.filter(c => c !== 'de')) {
    const onTerms = note(render(h(TermsBody, { lang })))
    assert.ok(onTerms, `${lang}: note`)
    assert.equal(onTerms, note(render(h(PrivacyBody, { lang }))), lang)
  }
  assert.doesNotMatch(render(h(Impressum)), /<em/)
})

test('small translation slips stay fixed: no English "plus … via" in the lists, no softened instruction in the Polish disclaimer', () => {
  for (const lang of ['de', 'fr', 'es', 'it']) assert.doesNotMatch(plain(render(h(PrivacyBody, { lang }))), /plus ECMWF/, lang)
  const pl = render(h(TermsBody, { lang: 'pl' }))
  assert.match(paragraphs(section(pl, headings(pl)[0]))[1], /Należy przerwać wycieczkę/)
})

const impressum = () => render(h(Impressum))
const article = (html, lang) => html.split('<article').find(a => a.includes(`lang="${lang}"`))

test('/impressum: all 13 languages are in the server HTML, each with operator, address and email', () => {
  const html = impressum()
  for (const lang of CODES) {
    const a = article(html, lang)
    assert.ok(a, `${lang}: missing`)
    const text = plain(a)
    assert.match(text, /Rene Kostmann\nSiedlerstraße 19\n9900 Lienz/, lang)
    assert.match(text, /info@metablend\.app/, lang)
    assert.match(text, /§ 5 ECG|ECG 第 5 条|ECG第5条|ECG 제5조/, lang)
    assert.match(text, /Mediengesetz/, lang)
    assert.equal(headings(a).length, 4, `${lang}: sections`)
  }
})

test('/impressum German: the original, word for word', () => {
  const text = plain(article(impressum(), 'de'))
  for (const line of [
    'Impressum', 'Informationen gemäß § 5 ECG und Offenlegung gemäß § 25 Mediengesetz',
    'Medieninhaber und Betreiber', 'Österreich', 'Kontakt', 'E-Mail: info@metablend.app',
    'Unternehmensgegenstand', 'Entwicklung und Bereitstellung von Software und Wetterprognosediensten.',
    'Grundlegende Richtung (Blattlinie)', 'Bereitstellung von Wetterinformationen und aggregierten Prognosedaten.',
  ]) assert.ok(text.includes(line), line)
})

test('/impressum: the business-registration block is prepared but not shown, and there is no ODR link', () => {
  // source-match-ok: the prepared business-registration block is a comment, visible only in the source
  const html = impressum()
  for (const word of ['Aufsichtsbehörde', 'Wirtschaftskammer', 'Gewerbeordnung', 'UID']) assert.ok(!html.includes(word), word)
  assert.match(fs.readFileSync(path.join(ROOT, 'app/impressum/content.js'), 'utf8'), /Aufsichtsbehörde: Bezirkshauptmannschaft Lienz/)
  assert.doesNotMatch(html, /ec\.europa\.eu\/consumers\/odr|ODR/)
})

test('the street address is only on /impressum and in the privacy controller block', () => {
  const allowed = ['app/impressum/content.js', 'app/privacy/content.jsx', 'lib/legal-pages.test.js']
  const hits = pattern => execFileSync('git', ['grep', '--untracked', '-l', pattern], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  for (const pattern of ['Siedlerstra', '9900 Lienz']) assert.deepEqual(hits(pattern).filter(f => !allowed.includes(f)), [], pattern)
  assert.doesNotMatch(JSON.stringify(metadata), /Siedlerstra|Lienz/)
})

test('/impressum is linked from the footer, the app\'s More tab and the sitemap; the disclaimer from the hiking and aviation notes', () => {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
  assert.match(render(h(TermsBody, { lang: 'de' })), /href="\/impressum"/) // the footer
  assert.match(read('app/more/MoreClient.jsx'), /\['\/impressum', 'footerImpressum'\]/)
  assert.match(read('app/sitemap.js'), /\/impressum/)
  for (const f of ['app/components/hike/HikeNotes.jsx', 'app/mountains/[peak]/SummitPage.jsx', 'app/aviation/page.js', 'app/aviation/[icao]/page.js']) {
    assert.match(read(f), /href="\/terms#disclaimer"/, f)
  }
  for (const f of ['app/aviation/page.js', 'app/aviation/[icao]/page.js']) assert.match(read(f), /Not for flight planning\./, f)
})

test('every store listing links the privacy notice, the terms and the legal notice, without the address', () => {
  const metadata = path.join(ROOT, 'fastlane/metadata')
  const files = [
    ...fs.readdirSync(metadata).map(l => path.join(metadata, l, 'description.txt')),
    ...fs.readdirSync(path.join(metadata, 'android')).map(l => path.join(metadata, 'android', l, 'full_description.txt')),
  ].filter(f => fs.existsSync(f))
  assert.equal(files.length, 25)
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    for (const page of ['privacy', 'terms', 'impressum']) assert.ok(text.includes(`https://metablend.app/${page}`), `${f}: ${page}`)
    assert.doesNotMatch(text, /Siedlerstra|9900 Lienz/, f)
  }
})

// WeatherAPI.com's terms ask for a clear, conspicuous and intelligible end-user disclaimer: their own words
// (2026-11-09), with a German version beside them, on /terms, where the Sources panel's line links to.
const WEATHERAPI_NOTICE = 'Weather information displayed here is provided for general informational purposes only. Forecasts and conditions are probabilistic and may not be accurate for your specific location or time. This data should not be used as the sole basis for decisions involving personal safety, aviation, marine navigation, emergency planning, or other safety-critical activities. Always consult official meteorological services and relevant authorities for decisions where accuracy is critical.'
test('/terms: the WeatherAPI.com end-user disclaimer in its own words, a German version beside it, with its anchor, in every language', () => {
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    const text = plain(html)
    assert.ok(text.includes(WEATHERAPI_NOTICE), `${lang}: the notice verbatim`)
    assert.ok(text.includes('Die hier angezeigten Wetterinformationen dienen ausschließlich der allgemeinen Information.'), `${lang}: German version`)
    assert.ok(html.includes('id="weatherapi-notice"'), `${lang}: anchor`)
  }
})

// 2026-11-10: the terms notice (the app's first start, the website's one-time bar) replaced the cookie
// line. What the device keeps is the version of the terms the notice was confirmed for; nobody
// "consents" to the privacy notice (its basis is legitimate interest), so that word is gone from what
// stays on the device, in every language.
test('/privacy in all 13 languages: the device keeps the confirmed version of the terms, named by the button\'s own word; no consent is kept', async () => {
  const { t, loadLanguage } = await import('./i18n.js')
  const CONSENT = { en: /consent/i, de: /Zustimmung/, fr: /consentement/, es: /consentimiento/, it: /consenso/, nl: /toestemming/, pl: /zgod/i, cs: /souhlas/, sl: /privolit|soglasj/, pt: /consentimento/, ja: /同意/, zh: /同意/, ko: /동의/ }
  for (const lang of CODES) {
    await loadLanguage(lang)
    const device = render(h(PrivacyBody, { lang })).split('<section').slice(1).map(plain)[1]
    assert.match(device, /metablend_app/, `${lang}: the section about what stays on the device`)
    assert.ok(device.includes(t(lang, 'termsNoticeContinue')), `${lang}: names the button ("${t(lang, 'termsNoticeContinue')}")`)
    assert.doesNotMatch(device, CONSENT[lang], `${lang}: no consent among what is kept`)
  }
  const de = plain(render(h(PrivacyBody, { lang: 'de' })))
  assert.ok(de.includes('Beim ersten Besuch der Website und beim ersten Start der App wird außerdem festgehalten, für welche Fassung der Nutzungsbedingungen Sie den Hinweis mit „Weiter“ bestätigt haben. Diese Angabe bleibt auf Ihrem Gerät und erreicht unseren Server nicht.'))
  assert.ok(de.includes('Sprache, Temperatureinheit, Design, den gewählten Vorhersagezeitraum sowie zuletzt gesuchte und gespeicherte Städte.'))
  assert.ok(de.includes('Sprache, Einheit, Design und zuletzt gesuchte Städte liegen in Cookies und erreichen daher bei jedem Seitenaufruf unseren Server, der sie nicht speichert.'))
})
