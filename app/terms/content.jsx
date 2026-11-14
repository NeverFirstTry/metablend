'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'
import { DISCLAIMER } from './disclaimer'
import { TRANSLATION_NOTE } from '@/lib/legal-note'

const REPO = 'https://github.com/NeverFirstTry/metablend'
const ISSUES = `${REPO}/issues`

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{children}</a>
)

// The attribution list. The credit lines stay in the words their providers ask for, in every
// language; what stands around them (what the data is used for, that it is blended) is in the
// page's language, and a colon stands between the two.
const MODELS = 'NOAA (GFS, NBM), DWD ICON, Météo-France, CHMI, MeteoSwiss, ItaliaMeteo, KNMI, DMI, JMA, CMA'
const ATTRIBUTION = {
  en: {
    sep: ': ',
    models: 'incl. model feeds from ECMWF (IFS and the AI model AIFS), {models} and Environment Canada (GEM)',
    ecmwf: 'MetaBlend blends these data with other sources, so what it shows is changed from the original.',
    eaws: 'avalanche danger levels from the official bulletins of Europe’s avalanche warning services (via avalanche.report); avalanche region outlines CC0',
    meteoalarm: 'official weather warnings of Europe’s national weather services',
    weatherapi: 'Notice for the WeatherAPI.com data in the blend, in WeatherAPI’s words:',
    blended: 'blended with other sources, so changed from the original',
    radar: 'the rain radar map',
    meteostat: 'reference measurements for scoring the sources',
    airports: 'airport & runway data on the Aviation pages',
    osm: 'maps, routes, and the summits and huts in the hiking search (how our copy of them is made: {link})',
    routeMaps: 'route maps in the app',
    geonames: 'towns for the hiking search (summits and huts around a town)',
    overture: 'country boundaries, by which each summit and hut is given its country',
  },
  de: {
    sep: ': ',
    models: 'inkl. Modelldaten von ECMWF (IFS und das KI-Modell AIFS), {models} und Environment Canada (GEM)',
    ecmwf: 'MetaBlend mittelt diese Daten mit anderen Quellen, die Anzeige weicht daher vom Original ab.',
    eaws: 'Lawinengefahrenstufen aus den amtlichen Lageberichten der europäischen Lawinenwarndienste (über avalanche.report); Umrisse der Lawinenregionen CC0',
    meteoalarm: 'amtliche Wetterwarnungen der nationalen Wetterdienste Europas',
    weatherapi: 'Hinweis zu den WeatherAPI.com-Daten in der gemittelten Vorhersage, im Wortlaut von WeatherAPI:',
    blended: 'mit anderen Quellen gemittelt, daher gegenüber dem Original verändert',
    radar: 'die Regenradarkarte',
    meteostat: 'Referenzmessungen zur Bewertung der Quellen',
    airports: 'Flughafen- und Pistendaten auf den Aviation-Seiten',
    osm: 'Karten, Routen sowie die Gipfel und Hütten in der Wandersuche (wie unsere Kopie davon entsteht: {link})',
    routeMaps: 'Routenkarten in der App',
    geonames: 'Orte für die Wandersuche (Gipfel und Hütten rund um einen Ort)',
    overture: 'Ländergrenzen, nach denen jeder Gipfel und jede Hütte ihr Land erhält',
  },
  fr: {
    sep: ' : ',
    models: 'y compris les données de modèles d’ECMWF (IFS et le modèle d’IA AIFS), {models} et Environment Canada (GEM)',
    ecmwf: 'MetaBlend combine ces données avec d’autres sources ; ce qui est affiché diffère donc de l’original.',
    eaws: 'niveaux de danger d’avalanche issus des bulletins officiels des services de prévision des avalanches en Europe (via avalanche.report) ; contours des régions d’avalanche CC0',
    meteoalarm: 'alertes météo officielles des services météorologiques nationaux d’Europe',
    weatherapi: 'Avis concernant les données de WeatherAPI.com dans la prévision combinée, dans les termes de WeatherAPI :',
    blended: 'combiné avec d’autres sources, donc modifié par rapport à l’original',
    radar: 'la carte du radar de pluie',
    meteostat: 'mesures de référence pour évaluer les sources',
    airports: 'données d’aéroports et de pistes sur les pages Aviation',
    osm: 'cartes, itinéraires, ainsi que les sommets et refuges de la recherche de randonnée (comment notre copie est produite : {link})',
    routeMaps: 'cartes d’itinéraires dans l’application',
    geonames: 'localités pour la recherche de randonnée (sommets et refuges autour d’une localité)',
    overture: 'frontières des pays, d’après lesquelles chaque sommet et chaque refuge reçoit son pays',
  },
  es: {
    sep: ': ',
    models: 'incl. datos de modelos de ECMWF (IFS y el modelo de IA AIFS), {models} y Environment Canada (GEM)',
    ecmwf: 'MetaBlend combina estos datos con otras fuentes, por lo que lo mostrado difiere del original.',
    eaws: 'niveles de peligro de aludes de los boletines oficiales de los servicios de aludes de Europa (a través de avalanche.report); contornos de las regiones de aludes CC0',
    meteoalarm: 'avisos meteorológicos oficiales de los servicios meteorológicos nacionales de Europa',
    weatherapi: 'Aviso sobre los datos de WeatherAPI.com en la previsión combinada, en palabras de WeatherAPI:',
    blended: 'combinado con otras fuentes, por lo que difiere del original',
    radar: 'el mapa del radar de lluvia',
    meteostat: 'mediciones de referencia para evaluar las fuentes',
    airports: 'datos de aeropuertos y pistas en las páginas de Aviación',
    osm: 'mapas, rutas y las cumbres y refugios de la búsqueda de senderismo (cómo se elabora nuestra copia: {link})',
    routeMaps: 'mapas de rutas en la app',
    geonames: 'localidades para la búsqueda de senderismo (cumbres y refugios cerca de una localidad)',
    overture: 'fronteras de los países, según las cuales cada cumbre y cada refugio recibe su país',
  },
  it: {
    sep: ': ',
    models: 'compresi i dati dei modelli di ECMWF (IFS e il modello di IA AIFS), {models} ed Environment Canada (GEM)',
    ecmwf: 'MetaBlend combina questi dati con altre fonti, quindi ciò che mostra differisce dall’originale.',
    eaws: 'gradi di pericolo valanghe dai bollettini ufficiali dei servizi valanghe europei (tramite avalanche.report); contorni delle regioni valanghive CC0',
    meteoalarm: 'allerte meteo ufficiali dei servizi meteorologici nazionali europei',
    weatherapi: 'Avviso sui dati di WeatherAPI.com nella previsione combinata, nelle parole di WeatherAPI:',
    blended: 'combinato con altre fonti, quindi modificato rispetto all’originale',
    radar: 'la mappa del radar della pioggia',
    meteostat: 'misure di riferimento per valutare le fonti',
    airports: 'dati su aeroporti e piste nelle pagine Aviation',
    osm: 'mappe, percorsi e le cime e i rifugi della ricerca escursioni (come viene creata la nostra copia: {link})',
    routeMaps: 'mappe dei percorsi nell’app',
    geonames: 'località per la ricerca escursioni (cime e rifugi intorno a una località)',
    overture: 'confini dei paesi, in base ai quali ogni cima e ogni rifugio riceve il suo paese',
  },
  nl: {
    sep: ': ',
    models: 'incl. modeldata van ECMWF (IFS en het AI-model AIFS), {models} en Environment Canada (GEM)',
    ecmwf: 'MetaBlend combineert deze gegevens met andere bronnen; wat wordt getoond wijkt daardoor af van het origineel.',
    eaws: 'lawinegevarenniveaus uit de officiële berichten van de Europese lawinewaarschuwingsdiensten (via avalanche.report); contouren van de lawineregio’s CC0',
    meteoalarm: 'officiële weerwaarschuwingen van de nationale weerdiensten van Europa',
    weatherapi: 'Kennisgeving bij de gegevens van WeatherAPI.com in de gecombineerde verwachting, in de woorden van WeatherAPI:',
    blended: 'gecombineerd met andere bronnen en daardoor gewijzigd ten opzichte van het origineel',
    radar: 'de regenradarkaart',
    meteostat: 'referentiemetingen om de bronnen te beoordelen',
    airports: 'gegevens over luchthavens en start- en landingsbanen op de Aviation-pagina’s',
    osm: 'kaarten, routes en de toppen en hutten in de wandelzoekfunctie (hoe onze kopie daarvan wordt gemaakt: {link})',
    routeMaps: 'routekaarten in de app',
    geonames: 'plaatsen voor de wandelzoekfunctie (toppen en hutten rond een plaats)',
    overture: 'landsgrenzen, op basis waarvan elke top en elke hut zijn land krijgt',
  },
  pl: {
    sep: ': ',
    models: 'w tym dane modeli ECMWF (IFS i model AI AIFS), {models} oraz Environment Canada (GEM)',
    ecmwf: 'MetaBlend łączy te dane z innymi źródłami, więc prezentowane wartości różnią się od oryginału.',
    eaws: 'stopnie zagrożenia lawinowego z oficjalnych komunikatów europejskich służb lawinowych (przez avalanche.report); granice regionów lawinowych CC0',
    meteoalarm: 'oficjalne ostrzeżenia pogodowe krajowych służb meteorologicznych Europy',
    weatherapi: 'Informacja dotycząca danych WeatherAPI.com w łączonej prognozie, słowami WeatherAPI:',
    blended: 'połączone z innymi źródłami, a więc zmienione względem oryginału',
    radar: 'mapa radaru opadów',
    meteostat: 'pomiary referencyjne do oceny źródeł',
    airports: 'dane o lotniskach i drogach startowych na stronach Aviation',
    osm: 'mapy, trasy oraz szczyty i schroniska w wyszukiwarce górskiej (jak powstaje nasza kopia: {link})',
    routeMaps: 'mapy tras w aplikacji',
    geonames: 'miejscowości do wyszukiwarki górskiej (szczyty i schroniska wokół miejscowości)',
    overture: 'granice państw, według których każdy szczyt i każde schronisko otrzymuje swój kraj',
  },
  cs: {
    sep: ': ',
    models: 'včetně modelových dat ECMWF (IFS a model AI AIFS), {models} a Environment Canada (GEM)',
    ecmwf: 'MetaBlend tato data kombinuje s dalšími zdroji, takže zobrazené hodnoty se od originálu liší.',
    eaws: 'stupně lavinového nebezpečí z oficiálních zpráv evropských lavinových služeb (přes avalanche.report); obrysy lavinových oblastí CC0',
    meteoalarm: 'oficiální výstrahy národních meteorologických služeb Evropy',
    weatherapi: 'Upozornění k datům WeatherAPI.com v kombinované předpovědi, slovy WeatherAPI:',
    blended: 'zkombinováno s dalšími zdroji, a tedy změněno oproti originálu',
    radar: 'mapa srážkového radaru',
    meteostat: 'referenční měření pro hodnocení zdrojů',
    airports: 'údaje o letištích a drahách na stránkách Aviation',
    osm: 'mapy, trasy a vrcholy a chaty v turistickém vyhledávání (jak vzniká naše kopie: {link})',
    routeMaps: 'mapy tras v aplikaci',
    geonames: 'obce pro turistické vyhledávání (vrcholy a chaty v okolí obce)',
    overture: 'hranice států, podle nichž je každému vrcholu a každé chatě přiřazena země',
  },
  sl: {
    sep: ': ',
    models: 'vključno z modelskimi podatki ECMWF (IFS in model UI AIFS), {models} ter Environment Canada (GEM)',
    ecmwf: 'MetaBlend te podatke združuje z drugimi viri, zato se prikazano razlikuje od izvirnika.',
    eaws: 'stopnje nevarnosti plazov iz uradnih biltenov evropskih služb za opozarjanje pred plazovi (prek avalanche.report); obrisi lavinskih območij CC0',
    meteoalarm: 'uradna vremenska opozorila nacionalnih meteoroloških služb Evrope',
    weatherapi: 'Obvestilo o podatkih WeatherAPI.com v združeni napovedi, z besedami WeatherAPI:',
    blended: 'združeno z drugimi viri in zato spremenjeno glede na izvirnik',
    radar: 'karta padavinskega radarja',
    meteostat: 'referenčne meritve za ocenjevanje virov',
    airports: 'podatki o letališčih in stezah na straneh Aviation',
    osm: 'zemljevidi, poti ter vrhovi in koče v pohodniškem iskanju (kako nastane naša kopija: {link})',
    routeMaps: 'zemljevidi poti v aplikaciji',
    geonames: 'kraji za pohodniško iskanje (vrhovi in koče v okolici kraja)',
    overture: 'državne meje, po katerih vsak vrh in vsaka koča dobi svojo državo',
  },
  pt: {
    sep: ': ',
    models: 'incl. dados de modelos do ECMWF (IFS e o modelo de IA AIFS), {models} e Environment Canada (GEM)',
    ecmwf: 'O MetaBlend combina esses dados com outras fontes, portanto o que é exibido difere do original.',
    eaws: 'níveis de perigo de avalanche dos boletins oficiais dos serviços de alerta de avalanches da Europa (via avalanche.report); contornos das regiões de avalanche CC0',
    meteoalarm: 'alertas meteorológicos oficiais dos serviços meteorológicos nacionais da Europa',
    weatherapi: 'Aviso sobre os dados da WeatherAPI.com na previsão combinada, nas palavras da WeatherAPI:',
    blended: 'combinado com outras fontes e, portanto, alterado em relação ao original',
    radar: 'o mapa do radar de chuva',
    meteostat: 'medições de referência para avaliar as fontes',
    airports: 'dados de aeroportos e pistas nas páginas de Aviação',
    osm: 'mapas, rotas e os cumes e refúgios da busca de trilhas (como nossa cópia é produzida: {link})',
    routeMaps: 'mapas de rotas no app',
    geonames: 'localidades para a busca de trilhas (cumes e refúgios ao redor de uma localidade)',
    overture: 'fronteiras dos países, pelas quais cada cume e cada refúgio recebe o seu país',
  },
  ja: {
    sep: '：',
    models: 'ECMWF（IFSおよびAIモデルAIFS）、{models}、Environment Canada（GEM）のモデルデータを含みます',
    ecmwf: 'MetaBlendはこのデータを他のソースと組み合わせているため、表示内容は元のデータと異なります。',
    eaws: '欧州の雪崩警報機関の公式情報に基づく雪崩危険度（avalanche.report経由）。雪崩地域の境界線はCC0',
    meteoalarm: '欧州各国の気象機関による公式の気象警報',
    weatherapi: 'ブレンドに含まれるWeatherAPI.comのデータに関する通知（WeatherAPIの原文）：',
    blended: '他のソースと組み合わせているため、元のデータから変更されています',
    radar: '雨雲レーダーの地図',
    meteostat: '各ソースを採点するための基準測定値',
    airports: '航空ページの空港および滑走路のデータ',
    osm: '地図、ルート、ハイキング検索の山頂と山小屋（当サービスでの複製の作成方法：{link}）',
    routeMaps: 'アプリ内のルート地図',
    geonames: 'ハイキング検索用の町（町の周辺の山頂と山小屋）',
    overture: '国境線（各山頂・山小屋の国の判定に使用）',
  },
  zh: {
    sep: '：',
    models: '包括来自 ECMWF（IFS 和 AI 模型 AIFS）、{models} 以及 Environment Canada（GEM）的模型数据',
    ecmwf: 'MetaBlend 将这些数据与其他来源融合，因此显示的内容与原始数据不同。',
    eaws: '来自欧洲各雪崩预警机构官方公报的雪崩危险等级（经由 avalanche.report）；雪崩区域轮廓为 CC0',
    meteoalarm: '欧洲各国气象机构的官方天气预警',
    weatherapi: '关于融合预报中 WeatherAPI.com 数据的声明，WeatherAPI 原文如下：',
    blended: '已与其他来源融合，因此与原始数据不同',
    radar: '降雨雷达地图',
    meteostat: '用于评估各来源的参考观测值',
    airports: '航空页面上的机场和跑道数据',
    osm: '地图、路线，以及徒步搜索中的山峰和山屋（我们如何制作这份副本：{link}）',
    routeMaps: '应用中的路线地图',
    geonames: '徒步搜索所用的城镇（城镇周边的山峰和山屋）',
    overture: '国家边界（用于确定每座山峰和山屋所属的国家）',
  },
  ko: {
    sep: ': ',
    models: 'ECMWF(IFS 및 AI 모델 AIFS), {models}, Environment Canada(GEM)의 모델 데이터 포함',
    ecmwf: 'MetaBlend는 이 데이터를 다른 출처와 결합하므로 표시되는 내용은 원본과 다릅니다.',
    eaws: '유럽 눈사태 경보 기관들의 공식 정보에 따른 눈사태 위험 등급(avalanche.report 경유), 눈사태 지역 경계는 CC0',
    meteoalarm: '유럽 각국 기상청의 공식 기상 경보',
    weatherapi: '블렌드에 포함된 WeatherAPI.com 데이터에 대한 고지(WeatherAPI의 원문):',
    blended: '다른 출처와 결합하여 원본에서 변경됨',
    radar: '강수 레이더 지도',
    meteostat: '각 출처를 채점하기 위한 기준 측정값',
    airports: '항공 페이지의 공항 및 활주로 데이터',
    osm: '지도, 경로, 하이킹 검색의 산 정상과 산장(사본을 만드는 방법: {link})',
    routeMaps: '앱의 경로 지도',
    geonames: '하이킹 검색용 마을(마을 주변의 산 정상과 산장)',
    overture: '국경선(각 산 정상과 산장의 국가를 정하는 데 사용)',
  },
}
const EXT = { target: '_blank', rel: 'noopener noreferrer', className: 'hover:text-emerald-400' }

function AttributionList({ lang }) {
  const a = ATTRIBUTION[lang] ?? ATTRIBUTION.en
  const [osmBefore, osmAfter] = a.osm.split('{link}')
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
      <li><a href="https://open-meteo.com" {...EXT}>Open-Meteo</a> (CC BY 4.0){a.sep}“Weather data by Open-Meteo.com”, {a.models.replace('{models}', MODELS)}</li>
      <li>This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). Source: <a href="https://www.ecmwf.int" {...EXT}>www.ecmwf.int</a>. Licence: <a href="https://creativecommons.org/licenses/by/4.0/" {...EXT}>CC BY 4.0</a>. {a.ecmwf}</li>
      <li>ALADIN model forecasts. Source: Czech Hydrometeorological Institute (ČHMÚ), <a href="https://www.chmi.cz" {...EXT}>www.chmi.cz</a>. Licence: <a href="https://creativecommons.org/licenses/by/4.0/" {...EXT}>CC BY 4.0</a>. {a.ecmwf}</li>
      <li><a href="https://avalanches.org" {...EXT}>EAWS</a>{a.sep}{a.eaws}</li>
      <li><a href="https://meteoalarm.org" {...EXT}>MeteoAlarm</a> (EUMETNET, CC BY 4.0){a.sep}{a.meteoalarm}</li>
      <li><a href="https://www.met.no" {...EXT}>MET Norway</a> (NLOD / CC BY 4.0){a.sep}“Data from MET Norway”</li>
      <li><a href="https://openweathermap.org" {...EXT}>Weather data © OpenWeather</a> (ODbL) · <a href="https://www.weatherapi.com/" {...EXT}>Powered by WeatherAPI.com</a> · <a href="https://www.visualcrossing.com" {...EXT}>Weather data provided by Visual Crossing Weather</a></li>
      <li id="weatherapi-notice" className="scroll-mt-6">{a.weatherapi} “Weather information displayed here is provided for general informational purposes only. Forecasts and conditions are probabilistic and may not be accurate for your specific location or time. This data should not be used as the sole basis for decisions involving personal safety, aviation, marine navigation, emergency planning, or other safety-critical activities. Always consult official meteorological services and relevant authorities for decisions where accuracy is critical.”<br />Deutsche Fassung: Die hier angezeigten Wetterinformationen dienen ausschließlich der allgemeinen Information. Vorhersagen und Wetterlagen sind probabilistisch und können für Ihren konkreten Ort oder Zeitpunkt ungenau sein. Diese Daten sollten nicht als alleinige Grundlage für Entscheidungen verwendet werden, die die persönliche Sicherheit, die Luftfahrt, die Seeschifffahrt, die Notfallplanung oder andere sicherheitskritische Tätigkeiten betreffen. Ziehen Sie für Entscheidungen, bei denen Genauigkeit entscheidend ist, stets die amtlichen Wetterdienste und die zuständigen Behörden zu Rate.</li>
      <li><a href="https://data.hub.geosphere.at" {...EXT}>GeoSphere Austria</a> (CC BY 4.0){a.sep}{a.blended}</li>
      <li><a href="https://www.weather.gov" {...EXT}>NOAA</a> (NWS &amp; Aviation Weather METARs, US public domain) · <a href="https://brightsky.dev" {...EXT}>Bright Sky / DWD</a> (CC BY 4.0; Datenbasis: Deutscher Wetterdienst, eigene Bearbeitung: mit anderen Quellen gemittelt) · <a href="https://opendata.smhi.se" {...EXT}>SMHI</a> (CC BY 4.0){a.sep}{a.blended}</li>
      <li>Radar: <a href="https://www.rainviewer.com/" {...EXT}>Weather data by RainViewer</a>{a.sep}{a.radar}</li>
      <li>Source: <a href="https://meteostat.net" {...EXT}>Meteostat</a>, Deutscher Wetterdienst (CC BY 4.0){a.sep}{a.meteostat}</li>
      <li><a href="https://ourairports.com" {...EXT}>OurAirports</a> (public domain){a.sep}{a.airports}</li>
      <li>© <a href="https://www.openstreetmap.org/copyright" {...EXT}>OpenStreetMap</a> contributors (ODbL){a.sep}{osmBefore}<a href="https://github.com/NeverFirstTry/metablend/tree/main/scripts/places" {...EXT}>scripts/places</a>{osmAfter}</li>
      <li>Map data: © OpenStreetMap contributors, SRTM | Map style: © <a href="https://opentopomap.org" {...EXT}>OpenTopoMap</a> (CC-BY-SA){a.sep}{a.routeMaps}</li>
      <li><a href="https://docs.overturemaps.org/attribution/" {...EXT}>© OpenStreetMap contributors, Overture Maps Foundation</a> (ODbL){a.sep}{a.overture}</li>
      <li><a href="https://www.geonames.org/" {...EXT}>GeoNames</a> (CC BY 4.0){a.sep}{a.geonames}</li>
    </ul>
  )
}

// Full terms per language. The substance (license position, attribution) must
// stay identical across languages — change all of them together. The liability
// text itself lives in ./disclaimer.js and is shown first.
const CONTENT = {
  en: {
    updated: 'Last updated November 2026',
    accept: 'By using the website you accept these Terms of Use. In the app you accept them once, at first start, by selecting “Continue”.',
    t1: 'Terms ', t2: '& Copyright',
    sections: [
      { title: 'Beta: no warranty', body: <>MetaBlend is provided <strong>“as is”</strong> and is under active development. We make no warranty of availability or fitness for any purpose.</> },
      { title: 'Not for safety-critical use', body: <>Do not rely on MetaBlend for decisions where weather accuracy matters to safety: aviation, marine, hiking, mountaineering, ski touring, severe weather, medical, or similar. Always consult an official meteorological service. For mountain tours and avalanche danger, always check the official mountain weather forecast and the official avalanche bulletin of the region (avalanche warning service). The Aviation pages (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) are supplementary information only: never use them for flight planning or navigation; always obtain an official preflight briefing.</> },
      { title: 'Acceptable use', body: <>Please don’t abuse the service: no automated scraping, no attempts to overload the APIs, and no submitting deliberately false feedback to skew the accuracy rankings.</> },
      { id: 'copyright', title: 'Copyright', body: <>© 2026 Rene Kostmann. The source code is published on <A href={REPO}>GitHub</A> under the Functional Source License 1.1 with Apache 2.0 as the future license (FSL-1.1-ALv2): it may be used, modified and redistributed for any purpose, except for a commercial offering that competes with MetaBlend. Two years after its release, each version is additionally licensed under the Apache License 2.0. The MetaBlend name and logo are not covered by the license and remain the property of their author.</> },
      { title: 'Data sources & attribution', body: <>
        <p className="mb-2">Weather and map data are provided by third parties under their own terms; credit to:</p>
        <AttributionList lang="en" />
        <p className="mt-2 text-zinc-400">Weather data remains the property of its respective providers and is used under their licenses.</p>
      </> },
      { title: 'Changes', body: <>These terms may change as the app develops. The “last updated” date above reflects the current version. Questions? Open an issue on <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  de: {
    updated: 'Zuletzt aktualisiert November 2026',
    accept: 'Mit der Nutzung der Website akzeptieren Sie diese Nutzungsbedingungen. In der App akzeptieren Sie sie einmal beim ersten Start mit „Weiter“.',
    t1: 'Nutzung ', t2: '& Urheberrecht',
    sections: [
      { title: 'Beta: keine Gewährleistung', body: <>MetaBlend wird <strong>„wie besehen“</strong> bereitgestellt und befindet sich in aktiver Entwicklung. Wir übernehmen keine Gewähr für Verfügbarkeit oder Eignung für irgendeinen Zweck.</> },
      { title: 'Nicht für sicherheitskritische Zwecke', body: <>Verlassen Sie sich nicht auf MetaBlend, wenn Wettergenauigkeit sicherheitsrelevant ist: Luftfahrt, Seefahrt, Wandern, Bergsteigen, Skitouren, Unwetter, Medizin oder Ähnliches. Ziehen Sie immer einen offiziellen Wetterdienst zurate. Prüfen Sie für Bergtouren und zur Lawinengefahr immer den offiziellen Bergwetterbericht und den offiziellen Lawinenlagebericht der Region (Lawinenwarndienst). Die Aviation-Seiten (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) sind reine Zusatzinformation: niemals für Flugplanung oder Navigation verwenden; holen Sie immer ein offizielles Preflight-Briefing ein.</> },
      { title: 'Zulässige Nutzung', body: <>Bitte missbrauchen Sie den Dienst nicht: kein automatisiertes Scraping, keine Versuche, die APIs zu überlasten, und kein absichtlich falsches Feedback, um die Genauigkeits-Ranglisten zu verzerren.</> },
      { id: 'copyright', title: 'Urheberrecht', body: <>© 2026 Rene Kostmann. Der Quellcode ist auf <A href={REPO}>GitHub</A> veröffentlicht und steht unter der Functional Source License 1.1 mit Apache 2.0 als späterer Lizenz (FSL-1.1-ALv2): Er darf für jeden Zweck genutzt, verändert und weitergegeben werden, außer für ein kommerzielles Angebot, das mit MetaBlend konkurriert. Zwei Jahre nach ihrer Veröffentlichung steht jede Version zusätzlich unter der Apache-Lizenz 2.0. Name und Logo von MetaBlend sind von der Lizenz nicht erfasst und bleiben Eigentum ihres Urhebers.</> },
      { title: 'Datenquellen & Attribution', body: <>
        <p className="mb-2">Wetter- und Kartendaten stammen von Dritten und unterliegen deren Bedingungen; Dank an:</p>
        <AttributionList lang="de" />
        <p className="mt-2 text-zinc-400">Wetterdaten bleiben Eigentum der jeweiligen Anbieter und werden unter deren Lizenzen genutzt.</p>
      </> },
      { title: 'Änderungen', body: <>Diese Bedingungen können sich mit der Weiterentwicklung der App ändern. Das Datum „zuletzt aktualisiert“ oben zeigt die aktuelle Fassung. Fragen? Öffnen Sie ein Issue auf <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  fr: {
    updated: 'Dernière mise à jour : novembre 2026',
    accept: 'En utilisant le site web, vous acceptez les présentes conditions d’utilisation. Dans l’application, vous les acceptez une fois, au premier démarrage, en choisissant « Continuer ».',
    t1: 'Conditions ', t2: '& Droits',
    sections: [
      { title: 'Bêta : aucune garantie', body: <>MetaBlend est fourni <strong>« en l’état »</strong> et est en cours de développement actif. Nous ne garantissons ni la disponibilité, ni l’adéquation à un quelconque usage.</> },
      { title: 'Pas pour un usage critique pour la sécurité', body: <>Ne vous fiez pas à MetaBlend pour des décisions où la précision météo touche à la sécurité : aviation, navigation, randonnée, alpinisme, ski de randonnée, phénomènes violents, médical ou similaire. Consultez toujours un service météorologique officiel. Pour les courses en montagne et le risque d’avalanche, consultez toujours le bulletin météo de montagne officiel et le bulletin d’avalanche officiel de la région (service de prévision des avalanches). Les pages Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) ne sont qu’une information complémentaire : ne les utilisez jamais pour la préparation des vols ni la navigation ; obtenez toujours un briefing prévol officiel.</> },
      { title: 'Usage acceptable', body: <>Merci de ne pas abuser du service : pas de scraping automatisé, pas de tentatives de surcharger les API, et pas de signalements délibérément faux pour fausser les classements de précision.</> },
      { id: 'copyright', title: 'Droits d’auteur', body: <>© 2026 Rene Kostmann. Le code source est publié sur <A href={REPO}>GitHub</A> sous la Functional Source License 1.1, avec Apache 2.0 comme licence ultérieure (FSL-1.1-ALv2) : il peut être utilisé, modifié et redistribué à toute fin, sauf pour une offre commerciale concurrente de MetaBlend. Deux ans après sa publication, chaque version est en outre placée sous la licence Apache 2.0. Le nom et le logo de MetaBlend ne sont pas couverts par la licence et restent la propriété de leur auteur.</> },
      { title: 'Sources de données & attribution', body: <>
        <p className="mb-2">Les données météo et cartographiques sont fournies par des tiers selon leurs propres conditions ; crédits :</p>
        <AttributionList lang="fr" />
        <p className="mt-2 text-zinc-400">Les données météo restent la propriété de leurs fournisseurs respectifs et sont utilisées sous leurs licences.</p>
      </> },
      { title: 'Modifications', body: <>Ces conditions peuvent évoluer avec l’application. La date de « dernière mise à jour » ci-dessus reflète la version en vigueur. Des questions ? Ouvrez un ticket sur <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  es: {
    updated: 'Última actualización: noviembre de 2026',
    accept: 'Al usar el sitio web, usted acepta estas condiciones de uso. En la app las acepta una vez, en el primer inicio, al pulsar «Continuar».',
    t1: 'Términos ', t2: '& Derechos',
    sections: [
      { title: 'Beta: sin garantía', body: <>MetaBlend se ofrece <strong>«tal cual»</strong> y está en desarrollo activo. No garantizamos disponibilidad ni idoneidad para ningún fin.</> },
      { title: 'No apto para usos críticos de seguridad', body: <>No confíe en MetaBlend para decisiones donde la precisión meteorológica afecte a la seguridad: aviación, navegación, senderismo, alpinismo, esquí de travesía, fenómenos severos, medicina o similares. Consulte siempre un servicio meteorológico oficial. Para rutas de montaña y el peligro de aludes, consulte siempre el parte oficial de meteorología de montaña y el boletín oficial de aludes de la región (servicio de predicción de aludes). Las páginas de Aviación (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) son solo información complementaria: no las use nunca para planificación de vuelos ni navegación; obtenga siempre un briefing prevuelo oficial.</> },
      { title: 'Uso aceptable', body: <>Por favor, no abuse del servicio: nada de scraping automatizado, ni intentos de sobrecargar las API, ni feedback deliberadamente falso para distorsionar las clasificaciones de precisión.</> },
      { id: 'copyright', title: 'Derechos de autor', body: <>© 2026 Rene Kostmann. El código fuente está publicado en <A href={REPO}>GitHub</A> bajo la Functional Source License 1.1, con Apache 2.0 como licencia posterior (FSL-1.1-ALv2): puede usarse, modificarse y redistribuirse para cualquier fin, salvo para una oferta comercial que compita con MetaBlend. Dos años después de su publicación, cada versión queda además bajo la Licencia Apache 2.0. El nombre y el logotipo de MetaBlend no están cubiertos por la licencia y siguen siendo propiedad de su autor.</> },
      { title: 'Fuentes de datos y atribución', body: <>
        <p className="mb-2">Los datos meteorológicos y cartográficos los proporcionan terceros bajo sus propias condiciones; crédito a:</p>
        <AttributionList lang="es" />
        <p className="mt-2 text-zinc-400">Los datos meteorológicos siguen siendo propiedad de sus respectivos proveedores y se usan bajo sus licencias.</p>
      </> },
      { title: 'Cambios', body: <>Estos términos pueden cambiar a medida que la app evoluciona. La fecha de «última actualización» de arriba refleja la versión vigente. ¿Preguntas? Abra una incidencia en <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  it: {
    updated: 'Ultimo aggiornamento: novembre 2026',
    accept: 'Usando il sito web, Lei accetta i presenti termini di utilizzo. Nell’app li accetta una volta, al primo avvio, scegliendo «Continua».',
    t1: 'Termini ', t2: '& Copyright',
    sections: [
      { title: 'Beta: nessuna garanzia', body: <>MetaBlend è fornito <strong>«così com’è»</strong> ed è in sviluppo attivo. Non garantiamo disponibilità o idoneità ad alcuno scopo.</> },
      { title: 'Non per usi critici per la sicurezza', body: <>Non si affidi a MetaBlend per decisioni in cui la precisione meteo riguarda la sicurezza: aviazione, navigazione, escursionismo, alpinismo, scialpinismo, eventi severi, ambito medico o simili. Consulti sempre un servizio meteorologico ufficiale. Per le gite in montagna e il pericolo di valanghe, consulti sempre il bollettino meteo di montagna ufficiale e il bollettino valanghe ufficiale della regione (servizio valanghe). Le pagine Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) sono solo informazioni supplementari: non le usi mai per la pianificazione dei voli né per la navigazione; ottenga sempre un briefing pre-volo ufficiale.</> },
      { title: 'Uso accettabile', body: <>La preghiamo di non abusare del servizio: niente scraping automatizzato, niente tentativi di sovraccaricare le API e niente feedback deliberatamente falso per alterare le classifiche di precisione.</> },
      { id: 'copyright', title: 'Copyright', body: <>© 2026 Rene Kostmann. Il codice sorgente è pubblicato su <A href={REPO}>GitHub</A> con la Functional Source License 1.1 e Apache 2.0 come licenza successiva (FSL-1.1-ALv2): può essere usato, modificato e ridistribuito per qualsiasi scopo, tranne che per un’offerta commerciale in concorrenza con MetaBlend. Due anni dopo la sua pubblicazione, ogni versione è inoltre soggetta alla licenza Apache 2.0. Il nome e il logo di MetaBlend non sono coperti dalla licenza e restano proprietà del loro autore.</> },
      { title: 'Fonti dei dati e attribuzione', body: <>
        <p className="mb-2">I dati meteo e cartografici sono forniti da terze parti secondo le loro condizioni; si ringraziano:</p>
        <AttributionList lang="it" />
        <p className="mt-2 text-zinc-400">I dati meteo restano di proprietà dei rispettivi fornitori e sono usati secondo le loro licenze.</p>
      </> },
      { title: 'Modifiche', body: <>Questi termini possono cambiare con l’evolversi dell’app. La data di «ultimo aggiornamento» in alto riflette la versione corrente. Domande? Apra una issue su <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  nl: {
    updated: 'Laatst bijgewerkt november 2026',
    accept: 'Door de website te gebruiken accepteert u deze gebruiksvoorwaarden. In de app accepteert u ze één keer, bij de eerste start, met “Verder”.',
    t1: 'Voorwaarden ', t2: '& Auteursrecht',
    sections: [
      { title: 'Beta: geen garantie', body: <>MetaBlend wordt <strong>„zoals het is”</strong> aangeboden en is in actieve ontwikkeling. Wij geven geen garantie voor beschikbaarheid of geschiktheid voor enig doel.</> },
      { title: 'Niet voor veiligheidskritisch gebruik', body: <>Vertrouw niet op MetaBlend voor beslissingen waarbij de nauwkeurigheid van het weer van belang is voor de veiligheid: luchtvaart, scheepvaart, wandelen, bergbeklimmen, toerskiën, zwaar weer, medisch of vergelijkbaar. Raadpleeg altijd een officiële meteorologische dienst. Raadpleeg voor bergtochten en lawinegevaar altijd het officiële bergweerbericht en het officiële lawinebericht van de regio (lawinewaarschuwingsdienst). De Aviation-pagina’s (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) zijn uitsluitend aanvullende informatie: gebruik ze nooit voor vluchtplanning of navigatie; vraag altijd een officiële preflight-briefing aan.</> },
      { title: 'Aanvaardbaar gebruik', body: <>Misbruik de dienst alstublieft niet: geen geautomatiseerd scrapen, geen pogingen om de API’s te overbelasten en geen opzettelijk onjuiste feedback om de nauwkeurigheidsranglijsten te beïnvloeden.</> },
      { id: 'copyright', title: 'Auteursrecht', body: <>© 2026 Rene Kostmann. De broncode is op <A href={REPO}>GitHub</A> gepubliceerd onder de Functional Source License 1.1 met Apache 2.0 als latere licentie (FSL-1.1-ALv2): de code mag voor elk doel worden gebruikt, gewijzigd en verspreid, behalve voor een commercieel aanbod dat met MetaBlend concurreert. Twee jaar na publicatie valt elke versie daarnaast onder de Apache-licentie 2.0. De naam en het logo van MetaBlend vallen niet onder de licentie en blijven eigendom van hun auteur.</> },
      { title: 'Gegevensbronnen en vermelding', body: <>
        <p className="mb-2">Weer- en kaartgegevens worden door derden geleverd onder hun eigen voorwaarden; met dank aan:</p>
        <AttributionList lang="nl" />
        <p className="mt-2 text-zinc-400">Weergegevens blijven eigendom van de respectieve aanbieders en worden onder hun licenties gebruikt.</p>
      </> },
      { title: 'Wijzigingen', body: <>Deze voorwaarden kunnen veranderen naarmate de app zich ontwikkelt. De datum „laatst bijgewerkt” hierboven geeft de huidige versie weer. Vragen? Open een issue op <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  pl: {
    updated: 'Ostatnia aktualizacja: listopad 2026',
    accept: 'Korzystając ze strony internetowej, akceptują Państwo niniejsze warunki korzystania. W aplikacji akceptują je Państwo raz, przy pierwszym uruchomieniu, wybierając „Dalej”.',
    t1: 'Warunki ', t2: '& Prawa autorskie',
    sections: [
      { title: 'Beta: brak gwarancji', body: <>MetaBlend jest udostępniany <strong>„w stanie, w jakim jest”</strong> i jest w aktywnym rozwoju. Nie gwarantujemy dostępności ani przydatności do jakiegokolwiek celu.</> },
      { title: 'Nie do zastosowań krytycznych dla bezpieczeństwa', body: <>Nie należy polegać na MetaBlend przy decyzjach, w których dokładność pogody ma znaczenie dla bezpieczeństwa: lotnictwo, żegluga, wędrówki, wspinaczka górska, skitouring, groźne zjawiska, medycyna lub podobne. Należy zawsze korzystać z oficjalnej służby meteorologicznej. Przed wyjściem w góry i w sprawie zagrożenia lawinowego należy zawsze sprawdzić oficjalną prognozę pogody dla gór oraz oficjalny komunikat lawinowy dla danego regionu (służba lawinowa). Strony Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) to wyłącznie informacje uzupełniające: nigdy nie należy ich używać do planowania lotów ani nawigacji; należy zawsze uzyskać oficjalny briefing przedlotowy.</> },
      { title: 'Dopuszczalne użycie', body: <>Prosimy nie nadużywać usługi: żadnego automatycznego scrapingu, prób przeciążania API ani celowo fałszywych zgłoszeń zniekształcających rankingi dokładności.</> },
      { id: 'copyright', title: 'Prawa autorskie', body: <>© 2026 Rene Kostmann. Kod źródłowy jest opublikowany na <A href={REPO}>GitHub</A> na licencji Functional Source License 1.1 z Apache 2.0 jako licencją późniejszą (FSL-1.1-ALv2): wolno go używać, zmieniać i rozpowszechniać w dowolnym celu, z wyjątkiem oferty komercyjnej konkurującej z MetaBlend. Dwa lata po publikacji każda wersja jest dodatkowo objęta licencją Apache 2.0. Nazwa i logo MetaBlend nie są objęte licencją i pozostają własnością ich autora.</> },
      { title: 'Źródła danych i atrybucja', body: <>
        <p className="mb-2">Dane pogodowe i mapowe pochodzą od podmiotów trzecich na ich własnych warunkach; podziękowania dla:</p>
        <AttributionList lang="pl" />
        <p className="mt-2 text-zinc-400">Dane pogodowe pozostają własnością ich dostawców i są używane na podstawie ich licencji.</p>
      </> },
      { title: 'Zmiany', body: <>Te warunki mogą się zmieniać wraz z rozwojem aplikacji. Data „ostatniej aktualizacji” powyżej wskazuje aktualną wersję. Pytania? Prosimy zgłosić sprawę na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  cs: {
    updated: 'Naposledy aktualizováno v listopadu 2026',
    accept: 'Používáním webu přijímáte tyto podmínky používání. V aplikaci je přijímáte jednou, při prvním spuštění, volbou „Pokračovat“.',
    t1: 'Podmínky ', t2: '& Autorská práva',
    sections: [
      { title: 'Beta: bez záruky', body: <>MetaBlend je poskytován <strong>„tak, jak je“</strong> a je v aktivním vývoji. Neposkytujeme záruku dostupnosti ani vhodnosti pro jakýkoli účel.</> },
      { title: 'Ne pro bezpečnostně kritické použití', body: <>Nespoléhejte na MetaBlend při rozhodnutích, kde přesnost počasí ovlivňuje bezpečnost: letectví, námořní doprava, turistika, horolezectví, skialpinismus, nebezpečné jevy, zdravotnictví a podobně. Vždy se obraťte na oficiální meteorologickou službu. Pro horské túry a lavinové nebezpečí si vždy ověřte oficiální horskou předpověď počasí a oficiální lavinovou zprávu pro daný region (lavinová služba). Stránky Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) jsou pouze doplňkové informace: nikdy je nepoužívejte k plánování letů ani navigaci; vždy si opatřete oficiální předletový briefing.</> },
      { title: 'Přijatelné použití', body: <>Prosíme, nezneužívejte službu: žádný automatický scraping, žádné pokusy o přetížení API a žádná záměrně nepravdivá hlášení zkreslující žebříčky přesnosti.</> },
      { id: 'copyright', title: 'Autorská práva', body: <>© 2026 Rene Kostmann. Zdrojový kód je na <A href={REPO}>GitHub</A> zveřejněn pod licencí Functional Source License 1.1 s Apache 2.0 jako pozdější licencí (FSL-1.1-ALv2): smí se používat, upravovat a šířit k jakémukoli účelu, s výjimkou komerční nabídky, která konkuruje MetaBlend. Dva roky po zveřejnění se na každou verzi navíc vztahuje licence Apache 2.0. Název a logo MetaBlend nejsou licencí pokryty a zůstávají majetkem jejich autora.</> },
      { title: 'Zdroje dat a uvedení autorství', body: <>
        <p className="mb-2">Data o počasí a mapová data poskytují třetí strany za vlastních podmínek; poděkování patří:</p>
        <AttributionList lang="cs" />
        <p className="mt-2 text-zinc-400">Data o počasí zůstávají majetkem příslušných poskytovatelů a používají se podle jejich licencí.</p>
      </> },
      { title: 'Změny', body: <>Tyto podmínky se mohou s vývojem aplikace měnit. Datum „naposledy aktualizováno“ výše odpovídá aktuální verzi. Dotazy? Otevřete issue na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  sl: {
    updated: 'Zadnja posodobitev: november 2026',
    accept: 'Z uporabo spletnega mesta sprejemate te pogoje uporabe. V aplikaciji jih sprejmete enkrat, ob prvem zagonu, z izbiro »Naprej«.',
    t1: 'Pogoji ', t2: '& Avtorske pravice',
    sections: [
      { title: 'Beta: brez jamstva', body: <>MetaBlend je na voljo <strong>»tak, kot je«</strong> in je v aktivnem razvoju. Ne jamčimo za razpoložljivost ali primernost za kakršen koli namen.</> },
      { title: 'Ni za varnostno kritično uporabo', body: <>Ne zanašajte se na MetaBlend pri odločitvah, pri katerih je natančnost vremena pomembna za varnost: letalstvo, plovba, pohodništvo, alpinizem, turno smučanje, nevarni pojavi, medicina ali podobno. Vedno se posvetujte z uradno meteorološko službo. Za gorske ture in nevarnost plazov vedno preverite uradno gorsko vremensko napoved in uradni lavinski bilten za regijo (služba za opozarjanje pred plazovi). Strani Aviation (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) so le dopolnilne informacije: nikoli jih ne uporabljajte za načrtovanje letov ali navigacijo; vedno pridobite uradni predpoletni brifing.</> },
      { title: 'Sprejemljiva uporaba', body: <>Prosimo, ne zlorabljajte storitve: brez samodejnega zajemanja podatkov, brez poskusov preobremenitve API-jev in brez namerno lažnih odzivov, ki bi popačili lestvice natančnosti.</> },
      { id: 'copyright', title: 'Avtorske pravice', body: <>© 2026 Rene Kostmann. Izvorna koda je na <A href={REPO}>GitHub</A> objavljena pod licenco Functional Source License 1.1 z Apache 2.0 kot poznejšo licenco (FSL-1.1-ALv2): dovoljeno jo je uporabljati, spreminjati in razširjati za kateri koli namen, razen za komercialno ponudbo, ki konkurira MetaBlendu. Dve leti po objavi za vsako različico dodatno velja licenca Apache 2.0. Ime in logotip MetaBlenda nista zajeta v licenci in ostajata last njunega avtorja.</> },
      { title: 'Viri podatkov in navedba avtorstva', body: <>
        <p className="mb-2">Vremenske in kartografske podatke zagotavljajo tretje osebe pod svojimi pogoji; zahvala gre:</p>
        <AttributionList lang="sl" />
        <p className="mt-2 text-zinc-400">Vremenski podatki ostajajo last njihovih ponudnikov in se uporabljajo pod njihovimi licencami.</p>
      </> },
      { title: 'Spremembe', body: <>Ti pogoji se lahko spremenijo z razvojem aplikacije. Datum »zadnja posodobitev« zgoraj ustreza trenutni različici. Vprašanja? Odprite zadevo na <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  pt: {
    updated: 'Última atualização: novembro de 2026',
    accept: 'Ao usar o site, você aceita estes termos de uso. No app, você os aceita uma vez, na primeira abertura, ao escolher “Continuar”.',
    t1: 'Termos ', t2: '& Direitos autorais',
    sections: [
      { title: 'Beta: sem garantia', body: <>O MetaBlend é fornecido <strong>“no estado em que se encontra”</strong> e está em desenvolvimento ativo. Não garantimos disponibilidade nem adequação a qualquer finalidade.</> },
      { title: 'Não use para fins críticos de segurança', body: <>Não confie no MetaBlend para decisões em que a precisão do tempo afete a segurança: aviação, navegação marítima, trilhas, montanhismo, esqui de travessia, fenômenos severos, medicina ou semelhantes. Consulte sempre um serviço meteorológico oficial. Para passeios na montanha e o risco de avalanche, consulte sempre a previsão oficial do tempo de montanha e o boletim oficial de avalanches da região (serviço de alerta de avalanches). As páginas de Aviação (<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>) são apenas informação complementar: nunca as use para planejamento de voo ou navegação; obtenha sempre um briefing pré-voo oficial.</> },
      { title: 'Uso aceitável', body: <>Por favor, não abuse do serviço: nada de scraping automatizado, tentativas de sobrecarregar as APIs ou retornos deliberadamente falsos para distorcer os rankings de precisão.</> },
      { id: 'copyright', title: 'Direitos autorais', body: <>© 2026 Rene Kostmann. O código-fonte está publicado no <A href={REPO}>GitHub</A> sob a Functional Source License 1.1, com Apache 2.0 como licença posterior (FSL-1.1-ALv2): pode ser usado, modificado e redistribuído para qualquer finalidade, exceto para uma oferta comercial que concorra com o MetaBlend. Dois anos após a sua publicação, cada versão fica também sob a Licença Apache 2.0. O nome e o logotipo do MetaBlend não são cobertos pela licença e continuam sendo propriedade de seu autor.</> },
      { title: 'Fontes de dados e atribuição', body: <>
        <p className="mb-2">Os dados meteorológicos e de mapas são fornecidos por terceiros sob seus próprios termos; créditos a:</p>
        <AttributionList lang="pt" />
        <p className="mt-2 text-zinc-400">Os dados meteorológicos continuam sendo propriedade de seus respectivos fornecedores e são usados sob suas licenças.</p>
      </> },
      { title: 'Alterações', body: <>Estes termos podem mudar à medida que o app evolui. A data de “última atualização” acima indica a versão atual. Dúvidas? Abra uma issue no <A href={ISSUES}>GitHub</A>.</> },
    ],
  },

  ja: {
    updated: '最終更新：2026年11月',
    accept: 'ウェブサイトを利用すると、本利用規約に同意したことになります。アプリでは、初回起動時に一度、「続ける」を選ぶことで同意します。',
    t1: '利用規約 ', t2: '& 著作権',
    sections: [
      { title: 'ベータ版：保証なし', body: <>MetaBlendは<strong>「現状のまま」</strong>提供され、現在も開発中です。可用性や特定目的への適合性については保証しません。</> },
      { title: '安全に関わる用途には使用不可', body: <>航空、海事、ハイキング、登山、スキーツアー、荒天、医療など、気象の正確さが安全に関わる判断にMetaBlendを頼らないでください。必ず公式の気象機関を確認してください。山行や雪崩の危険については、必ず公式の山岳気象予報と、その地域の公式の雪崩情報（雪崩警報機関）を確認してください。航空ページ（<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>）は補足情報にすぎません。飛行計画やナビゲーションには絶対に使用せず、必ず公式の飛行前ブリーフィングを受けてください。</> },
      { title: '利用上のルール', body: <>サービスを悪用しないでください。自動スクレイピング、APIに過負荷をかける行為、精度ランキングを歪めるための故意に虚偽のフィードバックは禁止です。</> },
      { id: 'copyright', title: '著作権', body: <>© 2026 Rene Kostmann. ソースコードは<A href={REPO}>GitHub</A>で公開されており、Functional Source License 1.1（将来のライセンスはApache 2.0、FSL-1.1-ALv2）が適用されます。MetaBlendと競合する商用の製品またはサービスに用いる場合を除き、あらゆる目的で使用、改変、再配布できます。各バージョンには、公開から2年後にApache License 2.0も併せて適用されます。MetaBlendの名称とロゴはこのライセンスの対象ではなく、引き続き作者の所有物です。</> },
      { title: 'データソースとクレジット', body: <>
        <p className="mb-2">気象データと地図データは、第三者がそれぞれの条件で提供しています。クレジット：</p>
        <AttributionList lang="ja" />
        <p className="mt-2 text-zinc-400">気象データは各提供者の所有物であり、各ライセンスに基づいて使用しています。</p>
      </> },
      { title: '変更', body: <>本規約はアプリの開発に伴い変更されることがあります。上記の「最終更新」日が現行版を示します。ご質問は<A href={ISSUES}>GitHub</A>のissueでどうぞ。</> },
    ],
  },

  zh: {
    updated: '最后更新：2026 年 11 月',
    accept: '使用本网站即表示您接受本使用条款。在应用中，您在首次启动时选择“继续”，接受一次。',
    t1: '条款 ', t2: '& 版权',
    sections: [
      { title: '测试版：不作保证', body: <>MetaBlend 按<strong>“现状”</strong>提供，仍在积极开发中。我们不保证可用性或对任何用途的适用性。</> },
      { title: '不适用于安全攸关的用途', body: <>请勿在天气准确性关系到安全的决策中依赖 MetaBlend，例如航空、航海、徒步、登山、滑雪登山、恶劣天气、医疗或类似情况。请始终查询官方气象服务。进行山地行程以及涉及雪崩危险时，请始终查看官方山地天气预报和所在地区的官方雪崩公报（雪崩预警机构）。航空页面（<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>）仅为补充信息，切勿用于飞行计划或导航；请始终获取官方飞行前简报。</> },
      { title: '可接受的使用', body: <>请勿滥用本服务：禁止自动抓取、禁止尝试使 API 过载，也禁止故意提交虚假反馈以扭曲准确度排名。</> },
      { id: 'copyright', title: '版权', body: <>© 2026 Rene Kostmann。源代码在 <A href={REPO}>GitHub</A> 上公开，采用 Functional Source License 1.1，并以 Apache 2.0 作为后续许可（FSL-1.1-ALv2）：可出于任何目的使用、修改和再分发，但不得用于与 MetaBlend 竞争的商业产品或服务。每个版本在发布两年后同时适用 Apache License 2.0。MetaBlend 的名称和标志不在该许可范围内，仍归其作者所有。</> },
      { title: '数据来源与署名', body: <>
        <p className="mb-2">天气和地图数据由第三方按其条款提供；致谢：</p>
        <AttributionList lang="zh" />
        <p className="mt-2 text-zinc-400">天气数据仍归各提供方所有，并依其许可使用。</p>
      </> },
      { title: '变更', body: <>这些条款可能随应用的发展而变更。上方的“最后更新”日期表示当前版本。有问题？请在 <A href={ISSUES}>GitHub</A> 上提交 issue。</> },
    ],
  },

  ko: {
    updated: '최종 업데이트: 2026년 11월',
    accept: '웹사이트를 이용하면 본 이용약관에 동의하는 것으로 봅니다. 앱에서는 처음 실행할 때 한 번, “계속”을 눌러 동의합니다.',
    t1: '이용약관 ', t2: '& 저작권',
    sections: [
      { title: '베타: 보증 없음', body: <>MetaBlend는 <strong>“있는 그대로”</strong> 제공되며 활발히 개발 중입니다. 가용성이나 특정 목적에 대한 적합성을 보증하지 않습니다.</> },
      { title: '안전이 중요한 용도에는 사용 불가', body: <>항공, 해상, 하이킹, 등산, 스키 투어링, 악천후, 의료 등 날씨의 정확성이 안전에 영향을 주는 결정에 MetaBlend를 의존하지 마십시오. 항상 공식 기상 서비스를 확인하십시오. 산행과 눈사태 위험에 대해서는 항상 공식 산악 기상 예보와 해당 지역의 공식 눈사태 정보(눈사태 경보 기관)를 확인하십시오. 항공 페이지(<Link href="/aviation" className="text-emerald-400 hover:underline">/aviation</Link>)는 보조 정보일 뿐이며, 비행 계획이나 항법에 절대 사용하지 마십시오. 항상 공식 비행 전 브리핑을 받으십시오.</> },
      { title: '허용되는 사용', body: <>서비스를 악용하지 마십시오. 자동 스크래핑, API 과부하 시도, 정확도 순위를 왜곡하기 위한 고의적인 허위 피드백을 금지합니다.</> },
      { id: 'copyright', title: '저작권', body: <>© 2026 Rene Kostmann. 소스 코드는 <A href={REPO}>GitHub</A>에 공개되어 있으며 Functional Source License 1.1(향후 라이선스는 Apache 2.0, FSL-1.1-ALv2)이 적용됩니다. MetaBlend와 경쟁하는 상업적 제품이나 서비스에 쓰는 경우를 제외하고 어떤 목적으로든 사용, 수정, 재배포할 수 있습니다. 각 버전에는 공개 2년 후부터 Apache License 2.0도 함께 적용됩니다. MetaBlend의 이름과 로고는 이 라이선스의 대상이 아니며 계속 저작자의 소유입니다.</> },
      { title: '데이터 출처 및 저작자 표시', body: <>
        <p className="mb-2">날씨 및 지도 데이터는 제3자가 자체 조건에 따라 제공합니다. 감사 대상:</p>
        <AttributionList lang="ko" />
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
        <Link href="/" className="app-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>

        <h1 className="text-3xl font-bold mb-1">{c.t1}<span className="text-emerald-400">{c.t2}</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">{c.updated}</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          {TRANSLATION_NOTE[lang] && <p className="text-zinc-400"><em className="text-zinc-500">{TRANSLATION_NOTE[lang]}</em></p>}
          <p>{c.accept}</p>
          <Section id="disclaimer" title={d.title}>
            {d.paragraphs.map(p => <p key={p} className="mb-2 last:mb-0">{p}</p>)}
          </Section>
          {c.sections.map(s => (
            <Section key={s.title} id={s.id} title={s.title}>{s.body}</Section>
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
