'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'

const ISSUES = 'https://github.com/NeverFirstTry/metablend/issues'
const PLAUSIBLE = 'https://plausible.io/privacy'

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{children}</a>
)

// Full notice per language. Structure mirrors the English original; the
// substance (what is collected, retention, recipients) must stay identical
// across languages — change all five together.
const CONTENT = {
  en: {
    updated: 'Last updated July 2026',
    t1: 'Privacy', t2: 'Notice',
    intro: <>MetaBlend is a free, in-development weather app with <strong>no accounts and no sign-up</strong>. We keep data collection to the minimum needed to run the service and to measure how accurate each weather source is. This is a plain-language summary, not legal advice.</>,
    sections: [
      { title: 'What stays on your device', body: <>We store a few small preferences locally so the app remembers your choices: language, temperature unit, theme, your consent to this notice, and your recently searched and saved cities. The last forecast you viewed is cached so the app still works offline. None of this leaves your browser, and you can clear it anytime by clearing your site data.</> },
      { title: 'Weather feedback you submit', body: <>When you report “how’s the weather right now,” we store the city, the temperature and condition you entered, the date, and the searched city’s approximate map coordinates (from our geocoder — never your device’s GPS position). This is used to score how close each weather source was, and reports appear as city-level points on the public accuracy heatmap. It is not linked to your name, email, or any account, because there are none.</> },
      { title: 'Technical data', body: <>To stop abuse, we briefly use your IP address to rate-limit feedback (one report per city per hour). It is used in memory for that check and is not stored alongside your feedback.</> },
      { title: 'Analytics', body: <>We use <A href={PLAUSIBLE}>Plausible Analytics</A>, a privacy-friendly, EU-hosted tool that counts visits <strong>without cookies</strong> and without collecting personal data. We only see aggregate numbers (e.g. page views), never individuals.</> },
      { title: 'Third-party services', body: <>
        <p className="mb-2">To produce a forecast we send the city or coordinates you search to weather and geocoding providers, and we receive their data back:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocoding, air quality, historical archive)</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — only if you use “my location”, to turn your coordinates into a city name (reverse geocoding)</li>
          <li>Weather Underground (The Weather Company) and Meteostat — receive city coordinates server-side to fetch reference measurements that score each source&apos;s accuracy</li>
          <li>Map tiles by OpenStreetMap contributors (heatmap and rain radar)</li>
        </ul>
        <p className="mt-2">The app is hosted on <strong>Vercel</strong> and its database runs on <strong>Supabase</strong> (EU region, Frankfurt). Each provider handles the data it receives under its own privacy policy.</p>
      </> },
      { title: 'How long we keep it', body: <>Stored forecasts and internal bookkeeping rows are automatically deleted by a daily cleanup job (typically within about 48 hours). Community feedback reports are kept for as long as they power the public accuracy heatmap and the long-term source rankings — or until you ask us to remove them (see below). Aggregate accuracy weights are anonymous and kept indefinitely.</> },
      { title: 'Your choices', body: <>You can use the app without sharing your location, clear your locally stored preferences anytime, and request removal of feedback data by opening an issue on our <A href={ISSUES}>GitHub repository</A>.</> },
      { title: 'Contact', body: <>Questions about privacy? Open an issue at <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. As MetaBlend evolves, this notice may change; the “last updated” date above will always reflect the current version.</> },
    ],
  },

  de: {
    updated: 'Zuletzt aktualisiert Juli 2026',
    t1: 'Datenschutz', t2: 'Erklärung',
    intro: <>MetaBlend ist eine kostenlose Wetter-App in Entwicklung — <strong>ohne Konten und ohne Registrierung</strong>. Wir sammeln nur so wenige Daten, wie für den Betrieb und die Genauigkeitsmessung der Wetterquellen nötig sind. Dies ist eine Zusammenfassung in einfacher Sprache, keine Rechtsberatung.</>,
    sections: [
      { title: 'Was auf deinem Gerät bleibt', body: <>Ein paar kleine Einstellungen werden lokal gespeichert, damit die App deine Auswahl behält: Sprache, Temperatureinheit, Design, deine Zustimmung zu diesem Hinweis sowie zuletzt gesuchte und gespeicherte Städte. Die zuletzt angesehene Vorhersage wird zwischengespeichert, damit die App auch offline funktioniert. Nichts davon verlässt deinen Browser, und du kannst alles jederzeit über die Website-Daten deines Browsers löschen.</> },
      { title: 'Wetter-Feedback, das du einreichst', body: <>Wenn du meldest, „wie das Wetter gerade ist“, speichern wir die Stadt, die eingegebene Temperatur und Wetterlage, das Datum und die ungefähren Kartenkoordinaten der gesuchten Stadt (aus unserem Geocoder — niemals die GPS-Position deines Geräts). Damit wird bewertet, wie nah jede Wetterquelle an der Wahrheit lag; Meldungen erscheinen als Punkte auf Stadtebene in der öffentlichen Genauigkeits-Heatmap. Eine Verknüpfung mit Name, E-Mail oder Konto gibt es nicht — es existieren keine Konten.</> },
      { title: 'Technische Daten', body: <>Um Missbrauch zu verhindern, verwenden wir deine IP-Adresse kurzzeitig zur Begrenzung von Feedback (eine Meldung pro Stadt und Stunde). Sie wird nur im Arbeitsspeicher für diese Prüfung genutzt und nicht zusammen mit deinem Feedback gespeichert.</> },
      { title: 'Analyse', body: <>Wir verwenden <A href={PLAUSIBLE}>Plausible Analytics</A>, ein datenschutzfreundliches, in der EU gehostetes Tool, das Besuche <strong>ohne Cookies</strong> und ohne personenbezogene Daten zählt. Wir sehen nur Gesamtzahlen (z.&nbsp;B. Seitenaufrufe), nie Einzelpersonen.</> },
      { title: 'Dienste von Drittanbietern', body: <>
        <p className="mb-2">Für eine Vorhersage senden wir die gesuchte Stadt bzw. deren Koordinaten an Wetter- und Geocoding-Anbieter und erhalten deren Daten zurück:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (inkl. Geocoding, Luftqualität, historisches Archiv)</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — nur bei „Mein Standort“, um Koordinaten in einen Stadtnamen zu übersetzen (Reverse-Geocoding)</li>
          <li>Weather Underground (The Weather Company) und Meteostat — erhalten serverseitig Stadtkoordinaten, um Referenzmessungen für die Genauigkeitsbewertung abzurufen</li>
          <li>Kartenkacheln von OpenStreetMap-Mitwirkenden (Heatmap und Regenradar)</li>
        </ul>
        <p className="mt-2">Die App läuft auf <strong>Vercel</strong>, die Datenbank auf <strong>Supabase</strong> (EU-Region, Frankfurt). Jeder Anbieter verarbeitet die erhaltenen Daten nach seiner eigenen Datenschutzerklärung.</p>
      </> },
      { title: 'Wie lange wir Daten aufbewahren', body: <>Gespeicherte Vorhersagen und interne Verwaltungseinträge werden von einem täglichen Aufräumjob automatisch gelöscht (in der Regel innerhalb von etwa 48 Stunden). Community-Feedback bleibt länger erhalten — es speist die öffentliche Heatmap und die langfristigen Ranglisten — bis du um Löschung bittest (siehe unten). Aggregierte Genauigkeitsgewichte sind anonym und werden unbegrenzt aufbewahrt.</> },
      { title: 'Deine Möglichkeiten', body: <>Du kannst die App ohne Standortfreigabe nutzen, deine lokal gespeicherten Einstellungen jederzeit löschen und die Entfernung von Feedback-Daten über ein Issue in unserem <A href={ISSUES}>GitHub-Repository</A> beantragen.</> },
      { title: 'Kontakt', body: <>Fragen zum Datenschutz? Öffne ein Issue unter <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend entwickelt sich weiter; das Datum „zuletzt aktualisiert“ oben zeigt immer die aktuelle Fassung.</> },
    ],
  },

  fr: {
    updated: 'Dernière mise à jour : juillet 2026',
    t1: 'Politique', t2: 'Confidentialité',
    intro: <>MetaBlend est une application météo gratuite, en cours de développement, <strong>sans compte ni inscription</strong>. Nous limitons la collecte de données au strict nécessaire pour faire fonctionner le service et mesurer la précision de chaque source météo. Ceci est un résumé en langage clair, pas un avis juridique.</>,
    sections: [
      { title: 'Ce qui reste sur votre appareil', body: <>Quelques petites préférences sont stockées localement pour que l’application retienne vos choix : langue, unité de température, thème, votre consentement à cette notice, ainsi que vos villes recherchées et enregistrées. La dernière prévision consultée est mise en cache pour que l’application fonctionne hors ligne. Rien de tout cela ne quitte votre navigateur, et vous pouvez tout effacer à tout moment via les données de site de votre navigateur.</> },
      { title: 'Les signalements météo que vous envoyez', body: <>Quand vous signalez « le temps qu’il fait en ce moment », nous enregistrons la ville, la température et la condition saisies, la date, ainsi que les coordonnées approximatives de la ville recherchée (issues de notre géocodeur — jamais la position GPS de votre appareil). Ces données servent à évaluer la précision de chaque source météo, et les signalements apparaissent comme des points à l’échelle de la ville sur la carte de précision publique. Ils ne sont liés à aucun nom, e-mail ou compte, puisqu’il n’en existe pas.</> },
      { title: 'Données techniques', body: <>Pour empêcher les abus, nous utilisons brièvement votre adresse IP afin de limiter les signalements (un par ville et par heure). Elle n’est utilisée qu’en mémoire pour ce contrôle et n’est pas stockée avec votre signalement.</> },
      { title: 'Statistiques', body: <>Nous utilisons <A href={PLAUSIBLE}>Plausible Analytics</A>, un outil respectueux de la vie privée et hébergé dans l’UE, qui compte les visites <strong>sans cookies</strong> et sans collecter de données personnelles. Nous ne voyons que des chiffres agrégés (p. ex. pages vues), jamais des individus.</> },
      { title: 'Services tiers', body: <>
        <p className="mb-2">Pour produire une prévision, nous envoyons la ville ou les coordonnées recherchées à des fournisseurs de météo et de géocodage, qui nous renvoient leurs données :</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (y compris géocodage, qualité de l’air, archives historiques)</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — uniquement si vous utilisez « ma position », pour convertir vos coordonnées en nom de ville (géocodage inverse)</li>
          <li>Weather Underground (The Weather Company) et Meteostat — reçoivent côté serveur les coordonnées des villes pour récupérer des mesures de référence servant à noter la précision de chaque source</li>
          <li>Tuiles cartographiques des contributeurs OpenStreetMap (carte et radar de pluie)</li>
        </ul>
        <p className="mt-2">L’application est hébergée sur <strong>Vercel</strong> et sa base de données sur <strong>Supabase</strong> (région UE, Francfort). Chaque fournisseur traite les données reçues selon sa propre politique de confidentialité.</p>
      </> },
      { title: 'Durée de conservation', body: <>Les prévisions stockées et les entrées internes de gestion sont supprimées automatiquement par un nettoyage quotidien (généralement sous 48 heures environ). Les signalements de la communauté sont conservés plus longtemps — ils alimentent la carte de précision publique et les classements à long terme — ou jusqu’à ce que vous en demandiez la suppression (voir ci-dessous). Les pondérations agrégées de précision sont anonymes et conservées indéfiniment.</> },
      { title: 'Vos choix', body: <>Vous pouvez utiliser l’application sans partager votre position, effacer vos préférences locales à tout moment et demander la suppression de vos signalements en ouvrant un ticket sur notre <A href={ISSUES}>dépôt GitHub</A>.</> },
      { title: 'Contact', body: <>Des questions sur la confidentialité ? Ouvrez un ticket sur <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend évolue ; la date de « dernière mise à jour » ci-dessus reflète toujours la version en vigueur.</> },
    ],
  },

  es: {
    updated: 'Última actualización: julio de 2026',
    t1: 'Aviso', t2: 'Privacidad',
    intro: <>MetaBlend es una app del tiempo gratuita y en desarrollo, <strong>sin cuentas ni registro</strong>. Recogemos los datos mínimos necesarios para operar el servicio y medir la precisión de cada fuente meteorológica. Esto es un resumen en lenguaje claro, no asesoramiento legal.</>,
    sections: [
      { title: 'Lo que se queda en tu dispositivo', body: <>Guardamos localmente unas pocas preferencias para que la app recuerde tus elecciones: idioma, unidad de temperatura, tema, tu consentimiento a este aviso y tus ciudades buscadas y guardadas. La última previsión que viste se guarda en caché para que la app funcione sin conexión. Nada de esto sale de tu navegador, y puedes borrarlo cuando quieras limpiando los datos del sitio.</> },
      { title: 'El feedback meteorológico que envías', body: <>Cuando informas de «qué tiempo hace ahora», guardamos la ciudad, la temperatura y condición introducidas, la fecha y las coordenadas aproximadas de la ciudad buscada (de nuestro geocodificador — nunca la posición GPS de tu dispositivo). Esto sirve para puntuar la precisión de cada fuente, y los informes aparecen como puntos a nivel de ciudad en el mapa público de precisión. No se vinculan a tu nombre, correo ni cuenta alguna, porque no existen cuentas.</> },
      { title: 'Datos técnicos', body: <>Para evitar abusos, usamos brevemente tu dirección IP para limitar el feedback (un informe por ciudad y hora). Solo se usa en memoria para esa comprobación y no se almacena junto a tu feedback.</> },
      { title: 'Analítica', body: <>Usamos <A href={PLAUSIBLE}>Plausible Analytics</A>, una herramienta respetuosa con la privacidad y alojada en la UE que cuenta visitas <strong>sin cookies</strong> y sin recopilar datos personales. Solo vemos cifras agregadas (p. ej. páginas vistas), nunca individuos.</> },
      { title: 'Servicios de terceros', body: <>
        <p className="mb-2">Para generar una previsión enviamos la ciudad o coordenadas que buscas a proveedores de meteorología y geocodificación, y recibimos sus datos:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocodificación, calidad del aire, archivo histórico)</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — solo si usas «mi ubicación», para convertir tus coordenadas en un nombre de ciudad (geocodificación inversa)</li>
          <li>Weather Underground (The Weather Company) y Meteostat — reciben coordenadas de ciudades en el servidor para obtener mediciones de referencia con las que puntuar la precisión de cada fuente</li>
          <li>Teselas de mapa de los colaboradores de OpenStreetMap (mapa y radar de lluvia)</li>
        </ul>
        <p className="mt-2">La app se aloja en <strong>Vercel</strong> y su base de datos en <strong>Supabase</strong> (región UE, Fráncfort). Cada proveedor trata los datos que recibe según su propia política de privacidad.</p>
      </> },
      { title: 'Cuánto tiempo lo conservamos', body: <>Las previsiones almacenadas y los registros internos se eliminan automáticamente con una limpieza diaria (normalmente en unas 48 horas). Los informes de la comunidad se conservan más tiempo — alimentan el mapa público de precisión y las clasificaciones a largo plazo — o hasta que pidas que los eliminemos (ver abajo). Las ponderaciones agregadas de precisión son anónimas y se conservan indefinidamente.</> },
      { title: 'Tus opciones', body: <>Puedes usar la app sin compartir tu ubicación, borrar tus preferencias locales cuando quieras y solicitar la eliminación de tus datos de feedback abriendo una incidencia en nuestro <A href={ISSUES}>repositorio de GitHub</A>.</> },
      { title: 'Contacto', body: <>¿Preguntas sobre privacidad? Abre una incidencia en <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend sigue evolucionando; la fecha de «última actualización» de arriba refleja siempre la versión vigente.</> },
    ],
  },

  it: {
    updated: 'Ultimo aggiornamento: luglio 2026',
    t1: 'Informativa', t2: 'Privacy',
    intro: <>MetaBlend è un’app meteo gratuita e in sviluppo, <strong>senza account e senza registrazione</strong>. Raccogliamo il minimo di dati necessario per far funzionare il servizio e misurare la precisione di ogni fonte meteo. Questo è un riepilogo in linguaggio semplice, non una consulenza legale.</>,
    sections: [
      { title: 'Cosa resta sul tuo dispositivo', body: <>Salviamo localmente alcune piccole preferenze perché l’app ricordi le tue scelte: lingua, unità di temperatura, tema, il tuo consenso a questa informativa e le città cercate e salvate di recente. L’ultima previsione visualizzata viene messa in cache così l’app funziona anche offline. Nulla di tutto ciò lascia il tuo browser, e puoi cancellarlo in qualsiasi momento eliminando i dati del sito.</> },
      { title: 'Il feedback meteo che invii', body: <>Quando segnali «che tempo fa adesso», salviamo la città, la temperatura e la condizione inserite, la data e le coordinate approssimative della città cercata (dal nostro geocoder — mai la posizione GPS del tuo dispositivo). Servono a valutare quanto ogni fonte meteo si è avvicinata alla realtà, e le segnalazioni compaiono come punti a livello di città sulla mappa pubblica della precisione. Non sono collegate a nome, e-mail o account, perché non esistono account.</> },
      { title: 'Dati tecnici', body: <>Per prevenire abusi usiamo brevemente il tuo indirizzo IP per limitare il feedback (una segnalazione per città all’ora). Viene usato solo in memoria per quel controllo e non viene salvato insieme al tuo feedback.</> },
      { title: 'Analisi', body: <>Usiamo <A href={PLAUSIBLE}>Plausible Analytics</A>, uno strumento rispettoso della privacy e ospitato nell’UE che conta le visite <strong>senza cookie</strong> e senza raccogliere dati personali. Vediamo solo numeri aggregati (es. pagine viste), mai singole persone.</> },
      { title: 'Servizi di terze parti', body: <>
        <p className="mb-2">Per produrre una previsione inviamo la città o le coordinate cercate a fornitori di dati meteo e geocoding, e riceviamo i loro dati:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocoding, qualità dell’aria, archivio storico)</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — solo se usi «la mia posizione», per convertire le coordinate in un nome di città (geocoding inverso)</li>
          <li>Weather Underground (The Weather Company) e Meteostat — ricevono lato server le coordinate delle città per ottenere misurazioni di riferimento con cui valutare la precisione di ogni fonte</li>
          <li>Tessere mappa dei collaboratori di OpenStreetMap (mappa e radar pioggia)</li>
        </ul>
        <p className="mt-2">L’app è ospitata su <strong>Vercel</strong> e il database su <strong>Supabase</strong> (regione UE, Francoforte). Ogni fornitore tratta i dati che riceve secondo la propria informativa sulla privacy.</p>
      </> },
      { title: 'Per quanto tempo li conserviamo', body: <>Le previsioni salvate e le righe interne di gestione vengono eliminate automaticamente da una pulizia giornaliera (di norma entro circa 48 ore). Le segnalazioni della community restano più a lungo — alimentano la mappa pubblica della precisione e le classifiche a lungo termine — o finché non ne chiedi la rimozione (vedi sotto). I pesi aggregati di precisione sono anonimi e conservati a tempo indeterminato.</> },
      { title: 'Le tue scelte', body: <>Puoi usare l’app senza condividere la posizione, cancellare le preferenze locali in qualsiasi momento e chiedere la rimozione dei tuoi dati di feedback aprendo una issue sul nostro <A href={ISSUES}>repository GitHub</A>.</> },
      { title: 'Contatti', body: <>Domande sulla privacy? Apri una issue su <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend continua a evolvere; la data di «ultimo aggiornamento» in alto riflette sempre la versione corrente.</> },
    ],
  },
}

export default function PrivacyContent() {
  const lang = useLang()
  const c = CONTENT[lang] ?? CONTENT.en

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>

        <h1 className="text-3xl font-bold mb-1">{c.t1}<span className="text-emerald-400">{c.t2}</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">{c.updated}</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <p className="text-zinc-400">{c.intro}</p>
          {c.sections.map(s => (
            <Section key={s.title} title={s.title}>{s.body}</Section>
          ))}
        </div>

        <Footer lang={lang} />
      </div>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-emerald-400 text-xs uppercase tracking-widest mb-2">{title}</h2>
      <div className="text-zinc-300">{children}</div>
    </section>
  )
}
