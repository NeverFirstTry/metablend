import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// The legal pages rendered for real, in every language. Node can't load JSX or
// the app's @/ and extensionless imports by itself, so these hooks do it for
// this test file only.
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const APP = new URL('../app/', import.meta.url).href
const onDisk = base => ['', '.js', '.jsx'].map(e => base + e).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return next('next/link.js', ctx)
    const ours = ctx.parentURL?.startsWith('file:') && !ctx.parentURL.includes('/node_modules/')
    const file = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2))
      : ours && spec.startsWith('.') ? fileURLToPath(new URL(spec, ctx.parentURL)) : null
    const hit = file && onDisk(file)
    return next(hit ? pathToFileURL(hit).href : spec, ctx)
  },
  load(url, ctx, next) {
    if (!url.startsWith(APP)) return next(url, ctx)
    const { outputText } = ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), {
      fileName: 'page.jsx',
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  },
})

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
  'MetaBlend fasst Wetterprognosen verschiedener öffentlicher Quellen automatisiert zusammen. Wetterprognosen sind naturgemäß unsicher. Die angezeigten Daten, Gipfelprognosen, Zeitfenster, Startzeiten und Warnungen sind unverbindliche Informationen ohne Gewähr für Richtigkeit, Vollständigkeit oder Aktualität. Datenquellen können ausfallen, verzögert oder fehlerhaft sein.',
  'MetaBlend ersetzt keine amtlichen Wetter- und Lawinenwarnungen (z. B. GeoSphere Austria, Lawinenwarndienst Tirol), keine Flugwetterberatung und keine eigene Beurteilung der Verhältnisse vor Ort. Planung und Durchführung von Touren, Flügen und sonstigen Aktivitäten erfolgen in eigener Verantwortung. Brechen Sie eine Tour ab, wenn die Bedingungen vor Ort von der Prognose abweichen. Im Notfall: Bergrettung 140, Euronotruf 112.',
  'Die Nutzung von MetaBlend ist kostenlos. Für Schäden, die aus der Nutzung oder Nichtverfügbarkeit der Informationen entstehen, haftet der Betreiber nicht, soweit sie leicht fahrlässig verursacht wurden. Eine Haftung besteht nur nach den gesetzlichen Bestimmungen, wenn ein Schaden vorsätzlich oder grob fahrlässig verursacht wurde oder wenn ein Schaden an Leben, Körper oder Gesundheit schuldhaft verursacht wurde.',
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
    assert.equal(disclaimer.length, 4, `${lang}: disclaimer paragraphs`)
    assert.match(disclaimer[1], /140[^]*112/, `${lang}: emergency numbers`)
    assert.match(disclaimer[1], /GeoSphere Austria.*Lawinenwarndienst Tirol/, `${lang}: official services`)
  }
})

test('/terms German: the liability text is the original, word for word', () => {
  const html = render(h(TermsBody, { lang: 'de' }))
  assert.deepEqual(paragraphs(section(html, 'Haftungsausschluss')), HAFTUNG)
})

test('/terms: the blanket "not liable for any loss" sentences are gone, the limited exclusion stands alone', () => {
  const de = plain(render(h(TermsBody, { lang: 'de' })))
  assert.doesNotMatch(de, /Wir haften nicht für/)
  const en = plain(render(h(TermsBody, { lang: 'en' })))
  assert.doesNotMatch(en, /not liable for any loss/)
  assert.doesNotMatch(en, /fully|under all circumstances/)
  // the exclusion covers slight negligence only; "nur" and "schuldhaft" stay clear in every language
  const TERMS = {
    de: ['leicht fahrlässig', 'nur nach den gesetzlichen Bestimmungen', 'schuldhaft'],
    en: ['slight negligence', 'only in accordance with the statutory provisions', 'culpably'],
    fr: ['négligence légère', 'n’existe que conformément aux dispositions légales', 'de manière fautive'],
    es: ['negligencia leve', 'Solo existe responsabilidad conforme a las disposiciones legales', 'de forma culpable'],
    it: ['colpa lieve', 'solo secondo le disposizioni di legge', 'in modo colpevole'],
    nl: ['lichte nalatigheid', 'alleen volgens de wettelijke bepalingen', 'verwijtbaar'],
    pl: ['lekkim niedbalstwem', 'tylko na podstawie przepisów ustawowych', 'w sposób zawiniony'],
    cs: ['lehkou nedbalostí', 'pouze podle zákonných ustanovení', 'zaviněně'],
    sl: ['lahke malomarnosti', 'samo v skladu z zakonskimi določbami', 'krivdno'],
    pt: ['culpa leve', 'Só existe responsabilidade nos termos das disposições legais', 'de forma culpável'],
    ja: ['軽過失', 'にのみ', '有責に'],
    zh: ['轻微过失', '只有', '过错'],
    ko: ['경과실', '에만', '유책하게'],
  }
  // the earlier wording, gone everywhere
  const OLD = /gesetzlich zulässigen Ausmaß|extent permitted by law|mesure permise par la loi|medida permitida por la ley|misura consentita dalla legge|voor zover wettelijk toegestaan|zakresie dozwolonym przez prawo|rozsahu povoleném zákonem|obsegu, ki ga dopušča zakon|medida permitida por lei|法律で認められる範囲|在法律允许的范围内|법률이 허용하는 범위/
  for (const lang of CODES) {
    const html = render(h(TermsBody, { lang }))
    const liability = paragraphs(section(html, headings(html)[0]))[2]
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
  for (const f of ['app/components/hike/HikeNotes.jsx', 'app/mountains/[peak]/page.js', 'app/aviation/page.js', 'app/aviation/[icao]/page.js']) {
    assert.match(read(f), /href="\/terms#disclaimer"/, f)
  }
  for (const f of ['app/aviation/page.js', 'app/aviation/[icao]/page.js']) assert.match(read(f), /Not for flight planning\./, f)
})
