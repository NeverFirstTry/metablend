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
    assert.match(text, /Barichgasse 40–42, 1030 Wien, www\.dsb\.gv\.at/, `${lang}: complaints`)
    assert.match(text, /ImprovMX[^.]*Minimum[^.]*7/, `${lang}: ImprovMX keeps only basic mail metadata (log level Minimum) for 7 days`)
    assert.match(text, /WeatherAPI[^;]{0,120}\b28\b/, `${lang}: WeatherAPI named as a processor (Art. 28) for the coordinates we send`)
    for (const service of ['Supabase', 'Plausible', 'Speed Insights', 'Web Analytics', 'BigDataCloud', 'Open-Meteo', 'Photon', 'OpenStreetMap', 'OpenTopoMap', 'Meteostat', 'RainViewer', 'unpkg', 'APNs', 'FCM', 'ImprovMX', 'Gmail']) {
      assert.ok(text.includes(service), `${lang}: ${service} still named`)
    }
    if (lang !== 'en') assert.notEqual(text, plain(en), `${lang}: falls back to English`)
  }
})

test('/privacy German: the supplied sections, word for word', () => {
  const html = render(h(PrivacyBody, { lang: 'de' }))
  assert.equal(plain(section(html, 'Verantwortlicher').replace(/^[^]*?<\/h2>/, '').trim()), 'Rene Kostmann, Siedlerstraße 19, 9900 Lienz, Österreich\nE-Mail: info@metablend.app')
  const hosting = plain(section(html, 'Hosting und Server-Logfiles').replace(/^[^]*?<\/h2>/, ''))
  assert.equal(hosting, 'Diese Website wird bei Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Daten: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser- und Betriebssysteminformationen sowie die zuvor besuchte Seite. Das dient dem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse). Die Logfiles werden nur für begrenzte Zeit gespeichert und danach gelöscht. Mit Vercel besteht ein Auftragsverarbeitungsvertrag. Vercel ist nach dem EU-US Data Privacy Framework zertifiziert; die Übermittlung in die USA erfolgt auf Grundlage des Angemessenheitsbeschlusses der EU-Kommission (Art. 45 DSGVO).')
  assert.ok(paragraphs(section(html, 'Kontakt')).includes('Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre E-Mail-Adresse und den Inhalt Ihrer Nachricht, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO). Die Daten werden gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten bestehen.'))
  assert.ok(paragraphs(section(html, 'Ihre Rechte und Möglichkeiten')).includes('Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Schreiben Sie dazu an info@metablend.app. Sie können sich außerdem bei der Österreichischen Datenschutzbehörde beschweren (Barichgasse 40–42, 1030 Wien, www.dsb.gv.at).'))
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
