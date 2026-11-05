'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'
import { DISCLAIMER } from './disclaimer'

const REPO = 'https://github.com/NeverFirstTry/metablend'
const ISSUES = `${REPO}/issues`

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{children}</a>
)

// The attribution list is identical in every language (proper names + licenses).
function AttributionList() {
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
      <li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">Open-Meteo</a> (CC BY 4.0) — incl. model feeds from ECMWF (IFS and the AI model AIFS), NOAA (GFS, NBM), DWD ICON, Météo-France, UK Met Office, MeteoSwiss, ItaliaMeteo, KNMI, DMI, JMA, CMA and Environment Canada (GEM)</li>
      <li><a href="https://avalanches.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">EAWS</a> — avalanche danger levels from the official bulletins of Europe&apos;s avalanche warning services (via avalanche.report); avalanche region outlines CC0</li>
      <li><a href="https://meteoalarm.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">MeteoAlarm</a> (EUMETNET, CC BY 4.0) — official weather warnings of Europe&apos;s national weather services</li>
      <li><a href="https://www.met.no" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">MET Norway</a> (NLOD / CC BY 4.0)</li>
      <li>OpenWeatherMap, WeatherAPI, Visual Crossing</li>
      <li><a href="https://data.hub.geosphere.at" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">GeoSphere Austria</a></li>
      <li><a href="https://www.weather.gov" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">NOAA</a> (NWS &amp; Aviation Weather METARs, US public domain) · <a href="https://brightsky.dev" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">Bright Sky / DWD</a> · <a href="https://opendata.smhi.se" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">SMHI</a> (CC BY 4.0)</li>
      <li><a href="https://ourairports.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">OurAirports</a> (public domain) — airport &amp; runway data on the Aviation pages</li>
      <li>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">OpenStreetMap</a> contributors (ODbL) — maps, routes, and the summits and huts in the hiking search (how our copy of them is made: <a href="https://github.com/NeverFirstTry/metablend/tree/main/scripts/places" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">scripts/places</a>)</li>
      <li><a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">GeoNames</a> (CC BY 4.0) — towns for the hiking search (summits and huts around a town)</li>
    </ul>
  )
}

// Full terms per language. The substance (license position, attribution) must
// stay identical across languages — change all of them together. The liability
// text itself lives in ./disclaimer.js and is shown first.
const CONTENT = {
  en: {
    updated: 'Last updated November 2026',
    t1: 'Terms', t2: '&Copyright',
    sections: [
      { title: 'Beta — no warranty', body: <>MetaBlend is provided <strong>“as is”</strong> and is under active development. We make no warranty of availability or fitness for any purpose.</> },
      { title: 'Not for safety-critical use', body: <>Do not rely on MetaBlend for decisions where weather accuracy matters to safety — aviation, marine, severe-weather, medical, or similar. Always consult an official meteorological service. The Aviation pages (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) are supplementary information only — never use them for flight planning or navigation; always obtain an official preflight briefing.</> },
      { title: 'Acceptable use', body: <>Please don’t abuse the service: no automated scraping, no attempts to overload the APIs, and no submitting deliberately false feedback to skew the accuracy rankings.</> },
      { title: 'Copyright', body: <>© {new Date().getFullYear()} MetaBlend. All rights reserved. The source code is published on <A href={REPO}>GitHub</A> for transparency only; this does not grant any license to copy, modify, or redistribute it. The MetaBlend name and design are the property of their author.</> },
      { title: 'Data sources & attribution', body: <>
        <p className="mb-2">Weather and map data are provided by third parties under their own terms; credit to:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Weather data remains the property of its respective providers and is used under their licenses.</p>
      </> },
      { title: 'Changes', body: <>These terms may change as the app develops. The “last updated” date above reflects the current version. Questions? Open an issue on <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  de: {
    updated: 'Zuletzt aktualisiert November 2026',
    t1: 'Nutzung', t2: '&Urheberrecht',
    sections: [
      { title: 'Beta — keine Gewährleistung', body: <>MetaBlend wird <strong>„wie besehen“</strong> bereitgestellt und befindet sich in aktiver Entwicklung. Wir übernehmen keine Gewähr für Verfügbarkeit oder Eignung für irgendeinen Zweck.</> },
      { title: 'Nicht für sicherheitskritische Zwecke', body: <>Verlass dich nicht auf MetaBlend, wenn Wettergenauigkeit sicherheitsrelevant ist — Luftfahrt, Seefahrt, Unwetter, Medizin oder Ähnliches. Ziehe immer einen offiziellen Wetterdienst zurate. Die Aviation-Seiten (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) sind reine Zusatzinformation — niemals für Flugplanung oder Navigation verwenden; hole immer ein offizielles Preflight-Briefing ein.</> },
      { title: 'Zulässige Nutzung', body: <>Bitte missbrauche den Dienst nicht: kein automatisiertes Scraping, keine Versuche, die APIs zu überlasten, und kein absichtlich falsches Feedback, um die Genauigkeits-Ranglisten zu verzerren.</> },
      { title: 'Urheberrecht', body: <>© {new Date().getFullYear()} MetaBlend. Alle Rechte vorbehalten. Der Quellcode ist auf <A href={REPO}>GitHub</A> nur der Transparenz halber veröffentlicht; daraus ergibt sich keine Lizenz zum Kopieren, Verändern oder Weiterverbreiten. Name und Design von MetaBlend sind Eigentum ihres Urhebers.</> },
      { title: 'Datenquellen & Attribution', body: <>
        <p className="mb-2">Wetter- und Kartendaten stammen von Dritten und unterliegen deren Bedingungen; Dank an:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Wetterdaten bleiben Eigentum der jeweiligen Anbieter und werden unter deren Lizenzen genutzt.</p>
      </> },
      { title: 'Änderungen', body: <>Diese Bedingungen können sich mit der Weiterentwicklung der App ändern. Das Datum „zuletzt aktualisiert“ oben zeigt die aktuelle Fassung. Fragen? Öffne ein Issue auf <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  fr: {
    updated: 'Dernière mise à jour : novembre 2026',
    t1: 'Conditions', t2: '&Droits',
    sections: [
      { title: 'Bêta — aucune garantie', body: <>MetaBlend est fourni <strong>« en l’état »</strong> et est en cours de développement actif. Nous ne garantissons ni la disponibilité, ni l’adéquation à un quelconque usage.</> },
      { title: 'Pas pour un usage critique pour la sécurité', body: <>Ne vous fiez pas à MetaBlend pour des décisions où la précision météo touche à la sécurité — aviation, navigation, phénomènes violents, médical ou similaire. Consultez toujours un service météorologique officiel. Les pages Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) ne sont qu’une information complémentaire — ne les utilisez jamais pour la préparation des vols ni la navigation ; obtenez toujours un briefing prévol officiel.</> },
      { title: 'Usage acceptable', body: <>Merci de ne pas abuser du service : pas de scraping automatisé, pas de tentatives de surcharger les API, et pas de signalements délibérément faux pour fausser les classements de précision.</> },
      { title: 'Droits d’auteur', body: <>© {new Date().getFullYear()} MetaBlend. Tous droits réservés. Le code source est publié sur <A href={REPO}>GitHub</A> à des fins de transparence uniquement ; cela n’accorde aucune licence de copie, de modification ou de redistribution. Le nom et le design de MetaBlend sont la propriété de leur auteur.</> },
      { title: 'Sources de données & attribution', body: <>
        <p className="mb-2">Les données météo et cartographiques sont fournies par des tiers selon leurs propres conditions ; crédits :</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Les données météo restent la propriété de leurs fournisseurs respectifs et sont utilisées sous leurs licences.</p>
      </> },
      { title: 'Modifications', body: <>Ces conditions peuvent évoluer avec l’application. La date de « dernière mise à jour » ci-dessus reflète la version en vigueur. Des questions ? Ouvrez un ticket sur <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  es: {
    updated: 'Última actualización: noviembre de 2026',
    t1: 'Términos', t2: '&Derechos',
    sections: [
      { title: 'Beta — sin garantía', body: <>MetaBlend se ofrece <strong>«tal cual»</strong> y está en desarrollo activo. No garantizamos disponibilidad ni idoneidad para ningún fin.</> },
      { title: 'No apto para usos críticos de seguridad', body: <>No confíes en MetaBlend para decisiones donde la precisión meteorológica afecte a la seguridad — aviación, navegación, fenómenos severos, medicina o similares. Consulta siempre un servicio meteorológico oficial. Las páginas de Aviación (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) son solo información complementaria — no las uses nunca para planificación de vuelos ni navegación; obtén siempre un briefing prevuelo oficial.</> },
      { title: 'Uso aceptable', body: <>Por favor, no abuses del servicio: nada de scraping automatizado, ni intentos de sobrecargar las API, ni feedback deliberadamente falso para distorsionar las clasificaciones de precisión.</> },
      { title: 'Derechos de autor', body: <>© {new Date().getFullYear()} MetaBlend. Todos los derechos reservados. El código fuente se publica en <A href={REPO}>GitHub</A> solo por transparencia; esto no concede licencia alguna para copiarlo, modificarlo o redistribuirlo. El nombre y el diseño de MetaBlend son propiedad de su autor.</> },
      { title: 'Fuentes de datos y atribución', body: <>
        <p className="mb-2">Los datos meteorológicos y cartográficos los proporcionan terceros bajo sus propias condiciones; crédito a:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Los datos meteorológicos siguen siendo propiedad de sus respectivos proveedores y se usan bajo sus licencias.</p>
      </> },
      { title: 'Cambios', body: <>Estos términos pueden cambiar a medida que la app evoluciona. La fecha de «última actualización» de arriba refleja la versión vigente. ¿Preguntas? Abre una incidencia en <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  it: {
    updated: 'Ultimo aggiornamento: novembre 2026',
    t1: 'Termini', t2: '&Copyright',
    sections: [
      { title: 'Beta — nessuna garanzia', body: <>MetaBlend è fornito <strong>«così com’è»</strong> ed è in sviluppo attivo. Non garantiamo disponibilità o idoneità ad alcuno scopo.</> },
      { title: 'Non per usi critici per la sicurezza', body: <>Non affidarti a MetaBlend per decisioni in cui la precisione meteo riguarda la sicurezza — aviazione, navigazione, eventi severi, ambito medico o simili. Consulta sempre un servizio meteorologico ufficiale. Le pagine Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) sono solo informazioni supplementari — non usarle mai per la pianificazione dei voli né per la navigazione; ottieni sempre un briefing pre-volo ufficiale.</> },
      { title: 'Uso accettabile', body: <>Per favore non abusare del servizio: niente scraping automatizzato, niente tentativi di sovraccaricare le API e niente feedback deliberatamente falso per alterare le classifiche di precisione.</> },
      { title: 'Copyright', body: <>© {new Date().getFullYear()} MetaBlend. Tutti i diritti riservati. Il codice sorgente è pubblicato su <A href={REPO}>GitHub</A> solo per trasparenza; ciò non concede alcuna licenza di copia, modifica o ridistribuzione. Il nome e il design di MetaBlend sono proprietà del loro autore.</> },
      { title: 'Fonti dei dati e attribuzione', body: <>
        <p className="mb-2">I dati meteo e cartografici sono forniti da terze parti secondo le loro condizioni; si ringraziano:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">I dati meteo restano di proprietà dei rispettivi fornitori e sono usati secondo le loro licenze.</p>
      </> },
      { title: 'Modifiche', body: <>Questi termini possono cambiare con l’evolversi dell’app. La data di «ultimo aggiornamento» in alto riflette la versione corrente. Domande? Apri una issue su <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  nl: {
    updated: 'Laatst bijgewerkt november 2026',
    t1: 'Voorwaarden', t2: '&Auteursrecht',
    sections: [
      { title: 'Beta — geen garantie', body: <>MetaBlend wordt <strong>„zoals het is”</strong> aangeboden en is in actieve ontwikkeling. Wij geven geen garantie voor beschikbaarheid of geschiktheid voor enig doel.</> },
      { title: 'Niet voor veiligheidskritisch gebruik', body: <>Vertrouw niet op MetaBlend voor beslissingen waarbij de nauwkeurigheid van het weer van belang is voor de veiligheid — luchtvaart, scheepvaart, zwaar weer, medisch of vergelijkbaar. Raadpleeg altijd een officiële meteorologische dienst. De Aviation-pagina’s (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) zijn uitsluitend aanvullende informatie — gebruik ze nooit voor vluchtplanning of navigatie; vraag altijd een officiële preflight-briefing aan.</> },
      { title: 'Aanvaardbaar gebruik', body: <>Misbruik de dienst alsjeblieft niet: geen geautomatiseerd scrapen, geen pogingen om de API’s te overbelasten en geen opzettelijk onjuiste feedback om de nauwkeurigheidsranglijsten te beïnvloeden.</> },
      { title: 'Auteursrecht', body: <>© {new Date().getFullYear()} MetaBlend. Alle rechten voorbehouden. De broncode is op <A href={REPO}>GitHub</A> gepubliceerd, uitsluitend voor transparantie; dit verleent geen licentie om deze te kopiëren, te wijzigen of te verspreiden. De naam en het ontwerp van MetaBlend zijn eigendom van hun auteur.</> },
      { title: 'Gegevensbronnen en vermelding', body: <>
        <p className="mb-2">Weer- en kaartgegevens worden door derden geleverd onder hun eigen voorwaarden; met dank aan:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Weergegevens blijven eigendom van de respectieve aanbieders en worden onder hun licenties gebruikt.</p>
      </> },
      { title: 'Wijzigingen', body: <>Deze voorwaarden kunnen veranderen naarmate de app zich ontwikkelt. De datum „laatst bijgewerkt” hierboven geeft de huidige versie weer. Vragen? Open een issue op <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  pl: {
    updated: 'Ostatnia aktualizacja: listopad 2026',
    t1: 'Warunki', t2: '&Prawa autorskie',
    sections: [
      { title: 'Beta — brak gwarancji', body: <>MetaBlend jest udostępniany <strong>„w stanie, w jakim jest”</strong> i jest w aktywnym rozwoju. Nie gwarantujemy dostępności ani przydatności do jakiegokolwiek celu.</> },
      { title: 'Nie do zastosowań krytycznych dla bezpieczeństwa', body: <>Nie polegaj na MetaBlend przy decyzjach, w których dokładność pogody ma znaczenie dla bezpieczeństwa — lotnictwo, żegluga, groźne zjawiska, medycyna lub podobne. Zawsze korzystaj z oficjalnej służby meteorologicznej. Strony Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) to wyłącznie informacje uzupełniające — nigdy nie używaj ich do planowania lotów ani nawigacji; zawsze uzyskaj oficjalny briefing przedlotowy.</> },
      { title: 'Dopuszczalne użycie', body: <>Prosimy nie nadużywać usługi: żadnego automatycznego scrapingu, prób przeciążania API ani celowo fałszywych zgłoszeń zniekształcających rankingi dokładności.</> },
      { title: 'Prawa autorskie', body: <>© {new Date().getFullYear()} MetaBlend. Wszelkie prawa zastrzeżone. Kod źródłowy jest opublikowany na <A href={REPO}>GitHub</A> wyłącznie dla przejrzystości; nie daje to żadnej licencji na jego kopiowanie, modyfikowanie ani rozpowszechnianie. Nazwa i projekt MetaBlend są własnością ich autora.</> },
      { title: 'Źródła danych i atrybucja', body: <>
        <p className="mb-2">Dane pogodowe i mapowe pochodzą od podmiotów trzecich na ich własnych warunkach; podziękowania dla:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Dane pogodowe pozostają własnością ich dostawców i są używane na podstawie ich licencji.</p>
      </> },
      { title: 'Zmiany', body: <>Te warunki mogą się zmieniać wraz z rozwojem aplikacji. Data „ostatniej aktualizacji” powyżej wskazuje aktualną wersję. Pytania? Zgłoś sprawę na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  cs: {
    updated: 'Naposledy aktualizováno v listopadu 2026',
    t1: 'Podmínky', t2: '&Autorská práva',
    sections: [
      { title: 'Beta — bez záruky', body: <>MetaBlend je poskytován <strong>„tak, jak je“</strong> a je v aktivním vývoji. Neposkytujeme záruku dostupnosti ani vhodnosti pro jakýkoli účel.</> },
      { title: 'Ne pro bezpečnostně kritické použití', body: <>Nespoléhejte na MetaBlend při rozhodnutích, kde přesnost počasí ovlivňuje bezpečnost — letectví, námořní doprava, nebezpečné jevy, zdravotnictví a podobně. Vždy se obraťte na oficiální meteorologickou službu. Stránky Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) jsou pouze doplňkové informace — nikdy je nepoužívejte k plánování letů ani navigaci; vždy si opatřete oficiální předletový briefing.</> },
      { title: 'Přijatelné použití', body: <>Prosíme, nezneužívejte službu: žádný automatický scraping, žádné pokusy o přetížení API a žádná záměrně nepravdivá hlášení zkreslující žebříčky přesnosti.</> },
      { title: 'Autorská práva', body: <>© {new Date().getFullYear()} MetaBlend. Všechna práva vyhrazena. Zdrojový kód je na <A href={REPO}>GitHub</A> zveřejněn pouze kvůli transparentnosti; neposkytuje se tím žádná licence k jeho kopírování, úpravám ani šíření. Název a design MetaBlend jsou majetkem jejich autora.</> },
      { title: 'Zdroje dat a uvedení autorství', body: <>
        <p className="mb-2">Data o počasí a mapová data poskytují třetí strany za vlastních podmínek; poděkování patří:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Data o počasí zůstávají majetkem příslušných poskytovatelů a používají se podle jejich licencí.</p>
      </> },
      { title: 'Změny', body: <>Tyto podmínky se mohou s vývojem aplikace měnit. Datum „naposledy aktualizováno“ výše odpovídá aktuální verzi. Dotazy? Otevřete issue na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  sl: {
    updated: 'Zadnja posodobitev: november 2026',
    t1: 'Pogoji', t2: '&Avtorske pravice',
    sections: [
      { title: 'Beta — brez jamstva', body: <>MetaBlend je na voljo <strong>»tak, kot je«</strong> in je v aktivnem razvoju. Ne jamčimo za razpoložljivost ali primernost za kakršen koli namen.</> },
      { title: 'Ni za varnostno kritično uporabo', body: <>Ne zanašaj se na MetaBlend pri odločitvah, pri katerih je natančnost vremena pomembna za varnost — letalstvo, plovba, nevarni pojavi, medicina ali podobno. Vedno se posvetuj z uradno meteorološko službo. Strani Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) so le dopolnilne informacije — nikoli jih ne uporabljaj za načrtovanje letov ali navigacijo; vedno pridobi uradni predpoletni brifing.</> },
      { title: 'Sprejemljiva uporaba', body: <>Prosimo, ne zlorabljaj storitve: brez samodejnega zajemanja podatkov, brez poskusov preobremenitve API-jev in brez namerno lažnih odzivov, ki bi popačili lestvice natančnosti.</> },
      { title: 'Avtorske pravice', body: <>© {new Date().getFullYear()} MetaBlend. Vse pravice pridržane. Izvorna koda je na <A href={REPO}>GitHub</A> objavljena samo zaradi preglednosti; to ne daje nobene licence za kopiranje, spreminjanje ali razširjanje. Ime in oblikovanje MetaBlenda sta last njunega avtorja.</> },
      { title: 'Viri podatkov in navedba avtorstva', body: <>
        <p className="mb-2">Vremenske in kartografske podatke zagotavljajo tretje osebe pod svojimi pogoji; zahvala gre:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Vremenski podatki ostajajo last njihovih ponudnikov in se uporabljajo pod njihovimi licencami.</p>
      </> },
      { title: 'Spremembe', body: <>Ti pogoji se lahko spremenijo z razvojem aplikacije. Datum »zadnja posodobitev« zgoraj ustreza trenutni različici. Vprašanja? Odpri zadevo na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  pt: {
    updated: 'Última atualização: novembro de 2026',
    t1: 'Termos', t2: '&Direitos autorais',
    sections: [
      { title: 'Beta — sem garantia', body: <>O MetaBlend é fornecido <strong>“no estado em que se encontra”</strong> e está em desenvolvimento ativo. Não garantimos disponibilidade nem adequação a qualquer finalidade.</> },
      { title: 'Não use para fins críticos de segurança', body: <>Não confie no MetaBlend para decisões em que a precisão do tempo afete a segurança — aviação, navegação marítima, fenômenos severos, medicina ou semelhantes. Consulte sempre um serviço meteorológico oficial. As páginas de Aviação (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) são apenas informação complementar — nunca as use para planejamento de voo ou navegação; obtenha sempre um briefing pré-voo oficial.</> },
      { title: 'Uso aceitável', body: <>Por favor, não abuse do serviço: nada de scraping automatizado, tentativas de sobrecarregar as APIs ou retornos deliberadamente falsos para distorcer os rankings de precisão.</> },
      { title: 'Direitos autorais', body: <>© {new Date().getFullYear()} MetaBlend. Todos os direitos reservados. O código-fonte é publicado no <A href={REPO}>GitHub</A> apenas por transparência; isso não concede nenhuma licença para copiá-lo, modificá-lo ou redistribuí-lo. O nome e o design do MetaBlend são propriedade de seu autor.</> },
      { title: 'Fontes de dados e atribuição', body: <>
        <p className="mb-2">Os dados meteorológicos e de mapas são fornecidos por terceiros sob seus próprios termos; créditos a:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">Os dados meteorológicos continuam sendo propriedade de seus respectivos fornecedores e são usados sob suas licenças.</p>
      </> },
      { title: 'Alterações', body: <>Estes termos podem mudar à medida que o app evolui. A data de “última atualização” acima indica a versão atual. Dúvidas? Abra uma issue no <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  ja: {
    updated: '最終更新：2026年11月',
    t1: '利用規約', t2: '&著作権',
    sections: [
      { title: 'ベータ版 — 保証なし', body: <>MetaBlendは<strong>「現状のまま」</strong>提供され、現在も開発中です。可用性や特定目的への適合性については保証しません。</> },
      { title: '安全に関わる用途には使用不可', body: <>航空、海事、荒天、医療など、気象の正確さが安全に関わる判断にMetaBlendを頼らないでください。必ず公式の気象機関を確認してください。航空ページ（<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>）は補足情報にすぎません。飛行計画やナビゲーションには絶対に使用せず、必ず公式の飛行前ブリーフィングを受けてください。</> },
      { title: '利用上のルール', body: <>サービスを悪用しないでください。自動スクレイピング、APIに過負荷をかける行為、精度ランキングを歪めるための故意に虚偽のフィードバックは禁止です。</> },
      { title: '著作権', body: <>© {new Date().getFullYear()} MetaBlend. All rights reserved. ソースコードは透明性のためにのみ<A href={REPO}>GitHub</A>で公開されています。これにより、コピー、改変、再配布のライセンスが付与されるものではありません。MetaBlendの名称とデザインは作者の所有物です。</> },
      { title: 'データソースとクレジット', body: <>
        <p className="mb-2">気象データと地図データは、第三者がそれぞれの条件で提供しています。クレジット：</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">気象データは各提供者の所有物であり、各ライセンスに基づいて使用しています。</p>
      </> },
      { title: '変更', body: <>本規約はアプリの開発に伴い変更されることがあります。上記の「最終更新」日が現行版を示します。ご質問は<A href={ISSUES}>GitHub</A>のissueでどうぞ。</> },
    ],
  },

  zh: {
    updated: '最后更新：2026 年 11 月',
    t1: '条款', t2: '&版权',
    sections: [
      { title: '测试版 — 不作保证', body: <>MetaBlend 按<strong>“现状”</strong>提供，仍在积极开发中。我们不保证可用性或对任何用途的适用性。</> },
      { title: '不适用于安全攸关的用途', body: <>请勿在天气准确性关系到安全的决策中依赖 MetaBlend，例如航空、航海、恶劣天气、医疗或类似情况。请始终查询官方气象服务。航空页面（<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>）仅为补充信息，切勿用于飞行计划或导航；请始终获取官方飞行前简报。</> },
      { title: '可接受的使用', body: <>请勿滥用本服务：禁止自动抓取、禁止尝试使 API 过载，也禁止故意提交虚假反馈以扭曲准确度排名。</> },
      { title: '版权', body: <>© {new Date().getFullYear()} MetaBlend。保留所有权利。源代码在 <A href={REPO}>GitHub</A> 上公开仅出于透明目的，并不授予任何复制、修改或再分发的许可。MetaBlend 的名称和设计归其作者所有。</> },
      { title: '数据来源与署名', body: <>
        <p className="mb-2">天气和地图数据由第三方按其条款提供；致谢：</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">天气数据仍归各提供方所有，并依其许可使用。</p>
      </> },
      { title: '变更', body: <>这些条款可能随应用的发展而变更。上方的“最后更新”日期表示当前版本。有问题？请在 <A href={ISSUES}>GitHub</A> 上提交 issue。</> },
    ],
  },

  ko: {
    updated: '최종 업데이트: 2026년 11월',
    t1: '이용약관', t2: '&저작권',
    sections: [
      { title: '베타 — 보증 없음', body: <>MetaBlend는 <strong>“있는 그대로”</strong> 제공되며 활발히 개발 중입니다. 가용성이나 특정 목적에 대한 적합성을 보증하지 않습니다.</> },
      { title: '안전이 중요한 용도에는 사용 불가', body: <>항공, 해상, 악천후, 의료 등 날씨의 정확성이 안전에 영향을 주는 결정에 MetaBlend를 의존하지 마십시오. 항상 공식 기상 서비스를 확인하십시오. 항공 페이지(<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>)는 보조 정보일 뿐이며, 비행 계획이나 항법에 절대 사용하지 마십시오. 항상 공식 비행 전 브리핑을 받으십시오.</> },
      { title: '허용되는 사용', body: <>서비스를 악용하지 마십시오. 자동 스크래핑, API 과부하 시도, 정확도 순위를 왜곡하기 위한 고의적인 허위 피드백을 금지합니다.</> },
      { title: '저작권', body: <>© {new Date().getFullYear()} MetaBlend. All rights reserved. 소스 코드는 투명성을 위해서만 <A href={REPO}>GitHub</A>에 공개되어 있으며, 이를 복사, 수정 또는 재배포할 라이선스를 부여하지 않습니다. MetaBlend의 이름과 디자인은 저작자의 소유입니다.</> },
      { title: '데이터 출처 및 저작자 표시', body: <>
        <p className="mb-2">날씨 및 지도 데이터는 제3자가 자체 조건에 따라 제공합니다. 감사 대상:</p>
        <AttributionList />
        <p className="mt-2 text-zinc-400">날씨 데이터는 각 제공자의 소유이며 해당 라이선스에 따라 사용됩니다.</p>
      </> },
      { title: '변경', body: <>이 약관은 앱의 발전에 따라 변경될 수 있습니다. 위의 “최종 업데이트” 날짜가 현재 버전을 나타냅니다. 질문이 있으면 <A href={ISSUES}>GitHub</A>에 issue를 등록하십시오.</> },
    ],
  },
}

export default function TermsContent() {
  return <TermsBody lang={useLang()} />
}

export function TermsBody({ lang }) {
  const c = CONTENT[lang] ?? CONTENT.en
  const d = DISCLAIMER[lang] ?? DISCLAIMER.en

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>

        <h1 className="text-3xl font-bold mb-1">{c.t1}<span className="text-emerald-400">{c.t2}</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">{c.updated}</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <Section id="disclaimer" title={d.title}>
            {d.paragraphs.map(p => <p key={p} className="mb-2 last:mb-0">{p}</p>)}
          </Section>
          {c.sections.map(s => (
            <Section key={s.title} title={s.title}>{s.body}</Section>
          ))}
        </div>

        <Footer lang={lang} />
      </div>
    </main>
  )
}

function Section({ id, title, children }) {
  return (
    <section id={id}>
      <h2 className="text-emerald-400 text-xs uppercase tracking-widest mb-2">{title}</h2>
      <div className="text-zinc-300">{children}</div>
    </section>
  )
}
