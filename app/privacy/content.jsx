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
// across languages — change all of them together.
const CONTENT = {
  en: {
    updated: 'Last updated October 2026',
    t1: 'Privacy', t2: 'Notice',
    intro: <>MetaBlend is a free, in-development weather app with <strong>no accounts and no sign-up</strong>. We keep data collection to the minimum needed to run the service and to measure how accurate each weather source is. This is a plain-language summary, not legal advice.</>,
    sections: [
      { title: 'What stays on your device', body: <>We store a few small preferences locally so the app remembers your choices: language, temperature unit, theme, your selected forecast range, your consent to this notice, and your recently searched and saved cities. The last forecast you viewed is cached so the app still works offline. None of this leaves your browser, and you can clear it anytime by clearing your site data.</> },
      { title: 'Weather feedback you submit', body: <>When you report “how’s the weather right now,” we store the city, the temperature and condition you entered, the date, and the searched city’s approximate map coordinates (from our geocoder — never your device’s GPS position). This is used to score how close each weather source was, and reports appear as city-level points on the public accuracy heatmap. It is not linked to your name, email, or any account, because there are none.</> },
      { title: 'Technical data', body: <>To stop abuse, we briefly use your IP address to rate-limit feedback (one report per city per hour). It is used in memory for that check and is not stored alongside your feedback.</> },
      { title: 'Analytics', body: <>We use <A href={PLAUSIBLE}>Plausible Analytics</A>, a privacy-friendly, EU-hosted tool that counts visits <strong>without cookies</strong> and without collecting personal data. We only see aggregate numbers (e.g. page views), never individuals. We also use <strong>Vercel Speed Insights</strong>, which measures how quickly pages load (anonymous performance numbers such as load time), likewise without cookies and without identifying you.</> },
      { title: 'Third-party services', body: <>
        <p className="mb-2">To produce a forecast we send the city or coordinates you search to weather and geocoding providers, and we receive their data back:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocoding, air quality, historical archive)</li>
          <li>Photon (komoot) and OpenStreetMap — peak search and summit heights: the search text and, with “Near me”, a location rounded to about 10 km; for marked routes our server sends only the summit’s coordinates</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — only if you use “my location”, to turn your coordinates into a city name (reverse geocoding)</li>
          <li>NOAA Aviation Weather (METAR reports) and Meteostat — receive city coordinates server-side to fetch reference measurements that score each source&apos;s accuracy</li>
          <li>Map tiles by OpenStreetMap contributors (heatmap and rain radar) and OpenTopoMap (route maps in the app)</li>
        </ul>
        <p className="mt-2">The app is hosted on <strong>Vercel</strong> and its database runs on <strong>Supabase</strong> (EU region, Frankfurt). Each provider handles the data it receives under its own privacy policy.</p>
      </> },
      { title: 'Notifications (app)', body: <>If you turn on notifications in the app, we store your phone’s push token (from Apple or Google), a hash of a random key the app creates, your home city, which alerts you switched on and your briefing hour, planned peaks and dates, your language and unit, and a log of what we sent in the last 14 days. There is no account and no location. Phones that haven’t opened the app for 90 days are deleted automatically, planned hikes after their day. Routes stay on your phone; a route you plan a hike on is stored with the plan to send its alerts and deleted with it. Turning notifications off in the app or deleting the app stops them.</> },
      { title: 'How long we keep it', body: <>Stored forecasts and internal bookkeeping rows are automatically deleted by a daily cleanup job (typically within about 48 hours); consensus snapshots and server error logs are deleted after 30 days. Community feedback reports are kept for as long as they power the public accuracy heatmap and the long-term source rankings — or until you ask us to remove them (see below). Aggregate accuracy weights are anonymous and kept indefinitely.</> },
      { title: 'Your choices', body: <>You can use the app without sharing your location, clear your locally stored preferences anytime, and request removal of feedback data by opening an issue on our <A href={ISSUES}>GitHub repository</A>.</> },
      { title: 'Contact', body: <>Questions about privacy? Email <A href="mailto:info@metablend.app">info@metablend.app</A> or open an issue at <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. As MetaBlend evolves, this notice may change; the “last updated” date above will always reflect the current version.</> },
    ],
  },

  de: {
    updated: 'Zuletzt aktualisiert Oktober 2026',
    t1: 'Datenschutz', t2: 'Erklärung',
    intro: <>MetaBlend ist eine kostenlose Wetter-App in Entwicklung — <strong>ohne Konten und ohne Registrierung</strong>. Wir sammeln nur so wenige Daten, wie für den Betrieb und die Genauigkeitsmessung der Wetterquellen nötig sind. Dies ist eine Zusammenfassung in einfacher Sprache, keine Rechtsberatung.</>,
    sections: [
      { title: 'Was auf deinem Gerät bleibt', body: <>Ein paar kleine Einstellungen werden lokal gespeichert, damit die App deine Auswahl behält: Sprache, Temperatureinheit, Design, den gewählten Vorhersagezeitraum, deine Zustimmung zu diesem Hinweis sowie zuletzt gesuchte und gespeicherte Städte. Die zuletzt angesehene Vorhersage wird zwischengespeichert, damit die App auch offline funktioniert. Nichts davon verlässt deinen Browser, und du kannst alles jederzeit über die Website-Daten deines Browsers löschen.</> },
      { title: 'Wetter-Feedback, das du einreichst', body: <>Wenn du meldest, „wie das Wetter gerade ist“, speichern wir die Stadt, die eingegebene Temperatur und Wetterlage, das Datum und die ungefähren Kartenkoordinaten der gesuchten Stadt (aus unserem Geocoder — niemals die GPS-Position deines Geräts). Damit wird bewertet, wie nah jede Wetterquelle an der Wahrheit lag; Meldungen erscheinen als Punkte auf Stadtebene in der öffentlichen Genauigkeits-Heatmap. Eine Verknüpfung mit Name, E-Mail oder Konto gibt es nicht — es existieren keine Konten.</> },
      { title: 'Technische Daten', body: <>Um Missbrauch zu verhindern, verwenden wir deine IP-Adresse kurzzeitig zur Begrenzung von Feedback (eine Meldung pro Stadt und Stunde). Sie wird nur im Arbeitsspeicher für diese Prüfung genutzt und nicht zusammen mit deinem Feedback gespeichert.</> },
      { title: 'Analyse', body: <>Wir verwenden <A href={PLAUSIBLE}>Plausible Analytics</A>, ein datenschutzfreundliches, in der EU gehostetes Tool, das Besuche <strong>ohne Cookies</strong> und ohne personenbezogene Daten zählt. Wir sehen nur Gesamtzahlen (z.&nbsp;B. Seitenaufrufe), nie Einzelpersonen. Außerdem nutzen wir <strong>Vercel Speed Insights</strong>, das misst, wie schnell Seiten laden (anonyme Leistungswerte wie die Ladezeit) — ebenfalls ohne Cookies und ohne dich zu identifizieren.</> },
      { title: 'Dienste von Drittanbietern', body: <>
        <p className="mb-2">Für eine Vorhersage senden wir die gesuchte Stadt bzw. deren Koordinaten an Wetter- und Geocoding-Anbieter und erhalten deren Daten zurück:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (inkl. Geocoding, Luftqualität, historisches Archiv)</li>
          <li>Photon (komoot) und OpenStreetMap — Gipfelsuche und Gipfelhöhen: der Suchtext und bei „In meiner Nähe“ ein auf etwa 10 km gerundeter Standort; für markierte Routen sendet unser Server nur die Koordinaten des Gipfels</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — nur bei „Mein Standort“, um Koordinaten in einen Stadtnamen zu übersetzen (Reverse-Geocoding)</li>
          <li>NOAA Aviation Weather (METAR-Meldungen) und Meteostat — erhalten serverseitig Stadtkoordinaten, um Referenzmessungen für die Genauigkeitsbewertung abzurufen</li>
          <li>Kartenkacheln von OpenStreetMap-Mitwirkenden (Heatmap und Regenradar) und OpenTopoMap (Routenkarten in der App)</li>
        </ul>
        <p className="mt-2">Die App läuft auf <strong>Vercel</strong>, die Datenbank auf <strong>Supabase</strong> (EU-Region, Frankfurt). Jeder Anbieter verarbeitet die erhaltenen Daten nach seiner eigenen Datenschutzerklärung.</p>
      </> },
      { title: 'Benachrichtigungen (App)', body: <>Wenn du in der App Benachrichtigungen einschaltest, speichern wir den Push-Token deines Telefons (von Apple oder Google), einen Hash eines zufälligen Schlüssels, den die App erzeugt, deine Heimatstadt, welche Hinweise du eingeschaltet hast und die Uhrzeit deines Morgenberichts, geplante Gipfel und Tage, Sprache und Einheit sowie ein Protokoll dessen, was wir in den letzten 14 Tagen gesendet haben. Es gibt kein Konto und keinen Standort. Telefone, die die App 90 Tage nicht geöffnet haben, werden automatisch gelöscht, geplante Touren nach ihrem Tag. Routen bleiben auf deinem Telefon; eine Route, auf der du eine Tour planst, wird mit dem Plan gespeichert, um ihre Hinweise zu senden, und mit ihm gelöscht. Benachrichtigungen in der App ausschalten oder die App löschen beendet sie.</> },
      { title: 'Wie lange wir Daten aufbewahren', body: <>Gespeicherte Vorhersagen und interne Verwaltungseinträge werden von einem täglichen Aufräumjob automatisch gelöscht (in der Regel innerhalb von etwa 48 Stunden); Konsens-Snapshots und Server-Fehlerprotokolle nach 30 Tagen. Community-Feedback bleibt länger erhalten — es speist die öffentliche Heatmap und die langfristigen Ranglisten — bis du um Löschung bittest (siehe unten). Aggregierte Genauigkeitsgewichte sind anonym und werden unbegrenzt aufbewahrt.</> },
      { title: 'Deine Möglichkeiten', body: <>Du kannst die App ohne Standortfreigabe nutzen, deine lokal gespeicherten Einstellungen jederzeit löschen und die Entfernung von Feedback-Daten über ein Issue in unserem <A href={ISSUES}>GitHub-Repository</A> beantragen.</> },
      { title: 'Kontakt', body: <>Fragen zum Datenschutz? Schreib an <A href="mailto:info@metablend.app">info@metablend.app</A> oder öffne ein Issue unter <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend entwickelt sich weiter; das Datum „zuletzt aktualisiert“ oben zeigt immer die aktuelle Fassung.</> },
    ],
  },

  fr: {
    updated: 'Dernière mise à jour : octobre 2026',
    t1: 'Politique', t2: 'Confidentialité',
    intro: <>MetaBlend est une application météo gratuite, en cours de développement, <strong>sans compte ni inscription</strong>. Nous limitons la collecte de données au strict nécessaire pour faire fonctionner le service et mesurer la précision de chaque source météo. Ceci est un résumé en langage clair, pas un avis juridique.</>,
    sections: [
      { title: 'Ce qui reste sur votre appareil', body: <>Quelques petites préférences sont stockées localement pour que l’application retienne vos choix : langue, unité de température, thème, la période de prévision choisie, votre consentement à cette notice, ainsi que vos villes recherchées et enregistrées. La dernière prévision consultée est mise en cache pour que l’application fonctionne hors ligne. Rien de tout cela ne quitte votre navigateur, et vous pouvez tout effacer à tout moment via les données de site de votre navigateur.</> },
      { title: 'Les signalements météo que vous envoyez', body: <>Quand vous signalez « le temps qu’il fait en ce moment », nous enregistrons la ville, la température et la condition saisies, la date, ainsi que les coordonnées approximatives de la ville recherchée (issues de notre géocodeur — jamais la position GPS de votre appareil). Ces données servent à évaluer la précision de chaque source météo, et les signalements apparaissent comme des points à l’échelle de la ville sur la carte de précision publique. Ils ne sont liés à aucun nom, e-mail ou compte, puisqu’il n’en existe pas.</> },
      { title: 'Données techniques', body: <>Pour empêcher les abus, nous utilisons brièvement votre adresse IP afin de limiter les signalements (un par ville et par heure). Elle n’est utilisée qu’en mémoire pour ce contrôle et n’est pas stockée avec votre signalement.</> },
      { title: 'Statistiques', body: <>Nous utilisons <A href={PLAUSIBLE}>Plausible Analytics</A>, un outil respectueux de la vie privée et hébergé dans l’UE, qui compte les visites <strong>sans cookies</strong> et sans collecter de données personnelles. Nous ne voyons que des chiffres agrégés (p. ex. pages vues), jamais des individus. Nous utilisons aussi <strong>Vercel Speed Insights</strong>, qui mesure la vitesse de chargement des pages (des mesures de performance anonymes, comme le temps de chargement), également sans cookies et sans vous identifier.</> },
      { title: 'Services tiers', body: <>
        <p className="mb-2">Pour produire une prévision, nous envoyons la ville ou les coordonnées recherchées à des fournisseurs de météo et de géocodage, qui nous renvoient leurs données :</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (y compris géocodage, qualité de l’air, archives historiques)</li>
          <li>Photon (komoot) et OpenStreetMap — recherche de sommets et altitudes : le texte recherché et, avec « Près de moi », une position arrondie à environ 10 km ; pour les itinéraires balisés, notre serveur n’envoie que les coordonnées du sommet</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — uniquement si vous utilisez « ma position », pour convertir vos coordonnées en nom de ville (géocodage inverse)</li>
          <li>NOAA Aviation Weather (relevés METAR) et Meteostat — reçoivent côté serveur les coordonnées des villes pour récupérer des mesures de référence servant à noter la précision de chaque source</li>
          <li>Tuiles cartographiques des contributeurs OpenStreetMap (carte et radar de pluie) et OpenTopoMap (cartes d’itinéraires dans l’app)</li>
        </ul>
        <p className="mt-2">L’application est hébergée sur <strong>Vercel</strong> et sa base de données sur <strong>Supabase</strong> (région UE, Francfort). Chaque fournisseur traite les données reçues selon sa propre politique de confidentialité.</p>
      </> },
      { title: 'Notifications (app)', body: <>Si vous activez les notifications dans l’app, nous enregistrons le jeton push de votre téléphone (d’Apple ou de Google), l’empreinte d’une clé aléatoire créée par l’app, votre ville principale, les alertes activées et l’heure de votre point du matin, les sommets et dates prévus, votre langue et votre unité, ainsi qu’un journal de ce que nous avons envoyé ces 14 derniers jours. Aucun compte, aucune position. Les téléphones qui n’ont pas ouvert l’app depuis 90 jours sont supprimés automatiquement, les randonnées prévues après leur jour. Les itinéraires restent sur votre téléphone ; un itinéraire sur lequel vous planifiez une randonnée est enregistré avec le plan pour envoyer ses alertes et supprimé avec lui. Désactiver les notifications dans l’app ou supprimer l’app les arrête.</> },
      { title: 'Durée de conservation', body: <>Les prévisions stockées et les entrées internes de gestion sont supprimées automatiquement par un nettoyage quotidien (généralement sous 48 heures environ) ; les instantanés du consensus et les journaux d’erreurs du serveur sont supprimés après 30 jours. Les signalements de la communauté sont conservés plus longtemps — ils alimentent la carte de précision publique et les classements à long terme — ou jusqu’à ce que vous en demandiez la suppression (voir ci-dessous). Les pondérations agrégées de précision sont anonymes et conservées indéfiniment.</> },
      { title: 'Vos choix', body: <>Vous pouvez utiliser l’application sans partager votre position, effacer vos préférences locales à tout moment et demander la suppression de vos signalements en ouvrant un ticket sur notre <A href={ISSUES}>dépôt GitHub</A>.</> },
      { title: 'Contact', body: <>Des questions sur la confidentialité ? Écrivez à <A href="mailto:info@metablend.app">info@metablend.app</A> ou ouvrez un ticket sur <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend évolue ; la date de « dernière mise à jour » ci-dessus reflète toujours la version en vigueur.</> },
    ],
  },

  es: {
    updated: 'Última actualización: octubre de 2026',
    t1: 'Aviso', t2: 'Privacidad',
    intro: <>MetaBlend es una app del tiempo gratuita y en desarrollo, <strong>sin cuentas ni registro</strong>. Recogemos los datos mínimos necesarios para operar el servicio y medir la precisión de cada fuente meteorológica. Esto es un resumen en lenguaje claro, no asesoramiento legal.</>,
    sections: [
      { title: 'Lo que se queda en tu dispositivo', body: <>Guardamos localmente unas pocas preferencias para que la app recuerde tus elecciones: idioma, unidad de temperatura, tema, el periodo de previsión elegido, tu consentimiento a este aviso y tus ciudades buscadas y guardadas. La última previsión que viste se guarda en caché para que la app funcione sin conexión. Nada de esto sale de tu navegador, y puedes borrarlo cuando quieras limpiando los datos del sitio.</> },
      { title: 'El feedback meteorológico que envías', body: <>Cuando informas de «qué tiempo hace ahora», guardamos la ciudad, la temperatura y condición introducidas, la fecha y las coordenadas aproximadas de la ciudad buscada (de nuestro geocodificador — nunca la posición GPS de tu dispositivo). Esto sirve para puntuar la precisión de cada fuente, y los informes aparecen como puntos a nivel de ciudad en el mapa público de precisión. No se vinculan a tu nombre, correo ni cuenta alguna, porque no existen cuentas.</> },
      { title: 'Datos técnicos', body: <>Para evitar abusos, usamos brevemente tu dirección IP para limitar el feedback (un informe por ciudad y hora). Solo se usa en memoria para esa comprobación y no se almacena junto a tu feedback.</> },
      { title: 'Analítica', body: <>Usamos <A href={PLAUSIBLE}>Plausible Analytics</A>, una herramienta respetuosa con la privacidad y alojada en la UE que cuenta visitas <strong>sin cookies</strong> y sin recopilar datos personales. Solo vemos cifras agregadas (p. ej. páginas vistas), nunca individuos. También usamos <strong>Vercel Speed Insights</strong>, que mide lo rápido que cargan las páginas (datos de rendimiento anónimos, como el tiempo de carga), igualmente sin cookies y sin identificarte.</> },
      { title: 'Servicios de terceros', body: <>
        <p className="mb-2">Para generar una previsión enviamos la ciudad o coordenadas que buscas a proveedores de meteorología y geocodificación, y recibimos sus datos:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocodificación, calidad del aire, archivo histórico)</li>
          <li>Photon (komoot) y OpenStreetMap — búsqueda de cumbres y altitudes: el texto buscado y, con «Cerca de mí», una ubicación redondeada a unos 10 km; para las rutas señalizadas nuestro servidor solo envía las coordenadas de la cumbre</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — solo si usas «mi ubicación», para convertir tus coordenadas en un nombre de ciudad (geocodificación inversa)</li>
          <li>NOAA Aviation Weather (informes METAR) y Meteostat — reciben coordenadas de ciudades en el servidor para obtener mediciones de referencia con las que puntuar la precisión de cada fuente</li>
          <li>Teselas de mapa de los colaboradores de OpenStreetMap (mapa y radar de lluvia) y OpenTopoMap (mapas de rutas en la app)</li>
        </ul>
        <p className="mt-2">La app se aloja en <strong>Vercel</strong> y su base de datos en <strong>Supabase</strong> (región UE, Fráncfort). Cada proveedor trata los datos que recibe según su propia política de privacidad.</p>
      </> },
      { title: 'Notificaciones (app)', body: <>Si activas las notificaciones en la app, guardamos el token push de tu teléfono (de Apple o Google), un hash de una clave aleatoria que crea la app, tu ciudad principal, qué avisos activaste y la hora de tu resumen matinal, las cumbres y fechas planificadas, tu idioma y unidad, y un registro de lo que enviamos en los últimos 14 días. No hay cuenta ni ubicación. Los teléfonos que no abren la app en 90 días se borran automáticamente, las excursiones planificadas después de su día. Las rutas se quedan en tu teléfono; una ruta en la que planificas una excursión se guarda con el plan para enviar sus avisos y se borra con él. Desactivar las notificaciones en la app o borrar la app las detiene.</> },
      { title: 'Cuánto tiempo lo conservamos', body: <>Las previsiones almacenadas y los registros internos se eliminan automáticamente con una limpieza diaria (normalmente en unas 48 horas); las instantáneas del consenso y los registros de errores del servidor, a los 30 días. Los informes de la comunidad se conservan más tiempo — alimentan el mapa público de precisión y las clasificaciones a largo plazo — o hasta que pidas que los eliminemos (ver abajo). Las ponderaciones agregadas de precisión son anónimas y se conservan indefinidamente.</> },
      { title: 'Tus opciones', body: <>Puedes usar la app sin compartir tu ubicación, borrar tus preferencias locales cuando quieras y solicitar la eliminación de tus datos de feedback abriendo una incidencia en nuestro <A href={ISSUES}>repositorio de GitHub</A>.</> },
      { title: 'Contacto', body: <>¿Preguntas sobre privacidad? Escribe a <A href="mailto:info@metablend.app">info@metablend.app</A> o abre una incidencia en <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend sigue evolucionando; la fecha de «última actualización» de arriba refleja siempre la versión vigente.</> },
    ],
  },

  it: {
    updated: 'Ultimo aggiornamento: ottobre 2026',
    t1: 'Informativa', t2: 'Privacy',
    intro: <>MetaBlend è un’app meteo gratuita e in sviluppo, <strong>senza account e senza registrazione</strong>. Raccogliamo il minimo di dati necessario per far funzionare il servizio e misurare la precisione di ogni fonte meteo. Questo è un riepilogo in linguaggio semplice, non una consulenza legale.</>,
    sections: [
      { title: 'Cosa resta sul tuo dispositivo', body: <>Salviamo localmente alcune piccole preferenze perché l’app ricordi le tue scelte: lingua, unità di temperatura, tema, il periodo di previsione scelto, il tuo consenso a questa informativa e le città cercate e salvate di recente. L’ultima previsione visualizzata viene messa in cache così l’app funziona anche offline. Nulla di tutto ciò lascia il tuo browser, e puoi cancellarlo in qualsiasi momento eliminando i dati del sito.</> },
      { title: 'Il feedback meteo che invii', body: <>Quando segnali «che tempo fa adesso», salviamo la città, la temperatura e la condizione inserite, la data e le coordinate approssimative della città cercata (dal nostro geocoder — mai la posizione GPS del tuo dispositivo). Servono a valutare quanto ogni fonte meteo si è avvicinata alla realtà, e le segnalazioni compaiono come punti a livello di città sulla mappa pubblica della precisione. Non sono collegate a nome, e-mail o account, perché non esistono account.</> },
      { title: 'Dati tecnici', body: <>Per prevenire abusi usiamo brevemente il tuo indirizzo IP per limitare il feedback (una segnalazione per città all’ora). Viene usato solo in memoria per quel controllo e non viene salvato insieme al tuo feedback.</> },
      { title: 'Analisi', body: <>Usiamo <A href={PLAUSIBLE}>Plausible Analytics</A>, uno strumento rispettoso della privacy e ospitato nell’UE che conta le visite <strong>senza cookie</strong> e senza raccogliere dati personali. Vediamo solo numeri aggregati (es. pagine viste), mai singole persone. Usiamo anche <strong>Vercel Speed Insights</strong>, che misura la velocità di caricamento delle pagine (dati di prestazione anonimi, come il tempo di caricamento), anch’esso senza cookie e senza identificarti.</> },
      { title: 'Servizi di terze parti', body: <>
        <p className="mb-2">Per produrre una previsione inviamo la città o le coordinate cercate a fornitori di dati meteo e geocoding, e riceviamo i loro dati:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocoding, qualità dell’aria, archivio storico)</li>
          <li>Photon (komoot) e OpenStreetMap — ricerca delle vette e quote: il testo cercato e, con «Vicino a me», una posizione arrotondata a circa 10 km; per i percorsi segnalati il nostro server invia solo le coordinate della vetta</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (US), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — solo se usi «la mia posizione», per convertire le coordinate in un nome di città (geocoding inverso)</li>
          <li>NOAA Aviation Weather (bollettini METAR) e Meteostat — ricevono lato server le coordinate delle città per ottenere misurazioni di riferimento con cui valutare la precisione di ogni fonte</li>
          <li>Tessere mappa dei collaboratori di OpenStreetMap (mappa e radar pioggia) e OpenTopoMap (mappe dei percorsi nell’app)</li>
        </ul>
        <p className="mt-2">L’app è ospitata su <strong>Vercel</strong> e il database su <strong>Supabase</strong> (regione UE, Francoforte). Ogni fornitore tratta i dati che riceve secondo la propria informativa sulla privacy.</p>
      </> },
      { title: 'Notifiche (app)', body: <>Se attivi le notifiche nell’app, salviamo il token push del tuo telefono (di Apple o Google), l’hash di una chiave casuale creata dall’app, la tua città principale, quali avvisi hai attivato e l’ora del tuo riepilogo mattutino, le vette e le date pianificate, lingua e unità, e un registro di ciò che abbiamo inviato negli ultimi 14 giorni. Nessun account, nessuna posizione. I telefoni che non aprono l’app da 90 giorni vengono eliminati automaticamente, le escursioni pianificate dopo il loro giorno. I percorsi restano sul tuo telefono; un percorso su cui pianifichi un’escursione viene salvato con il piano per inviarne gli avvisi e cancellato con esso. Disattivare le notifiche nell’app o eliminare l’app le interrompe.</> },
      { title: 'Per quanto tempo li conserviamo', body: <>Le previsioni salvate e le righe interne di gestione vengono eliminate automaticamente da una pulizia giornaliera (di norma entro circa 48 ore); gli snapshot del consenso e i log degli errori del server dopo 30 giorni. Le segnalazioni della community restano più a lungo — alimentano la mappa pubblica della precisione e le classifiche a lungo termine — o finché non ne chiedi la rimozione (vedi sotto). I pesi aggregati di precisione sono anonimi e conservati a tempo indeterminato.</> },
      { title: 'Le tue scelte', body: <>Puoi usare l’app senza condividere la posizione, cancellare le preferenze locali in qualsiasi momento e chiedere la rimozione dei tuoi dati di feedback aprendo una issue sul nostro <A href={ISSUES}>repository GitHub</A>.</> },
      { title: 'Contatti', body: <>Domande sulla privacy? Scrivi a <A href="mailto:info@metablend.app">info@metablend.app</A> o apri una issue su <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. MetaBlend continua a evolvere; la data di «ultimo aggiornamento» in alto riflette sempre la versione corrente.</> },
    ],
  },
  nl: {
    updated: 'Laatst bijgewerkt oktober 2026',
    t1: 'Privacy', t2: 'verklaring',
    intro: <><em className="text-zinc-500">Dit is een vertaling; als de versies verschillen, geldt de Engelse versie.</em><br /><br />MetaBlend is een gratis weer-app in ontwikkeling <strong>zonder accounts en zonder aanmelding</strong>. We verzamelen alleen de gegevens die nodig zijn om de dienst te laten werken en om te meten hoe nauwkeurig elke weerbron is. Dit is een samenvatting in gewone taal, geen juridisch advies.</>,
    sections: [
      { title: 'Wat op je apparaat blijft', body: <>We bewaren een paar kleine voorkeuren lokaal zodat de app je keuzes onthoudt: taal, temperatuureenheid, weergave, de gekozen verwachtingsperiode, je toestemming voor deze verklaring en je recent gezochte en bewaarde steden. De laatst bekeken verwachting wordt opgeslagen zodat de app ook offline werkt. Niets hiervan verlaat je browser, en je kunt het altijd wissen door je sitegegevens te wissen.</> },
      { title: 'Weerfeedback die je instuurt', body: <>Als je meldt „hoe is het weer nu”, bewaren we de stad, de temperatuur en het weertype dat je invoerde, de datum en de geschatte kaartcoördinaten van de gezochte stad (uit onze geocoder — nooit de gps-positie van je apparaat). Dit gebruiken we om te beoordelen hoe dicht elke weerbron erbij zat, en meldingen verschijnen als punten op stadsniveau op de openbare nauwkeurigheidskaart. Het is niet gekoppeld aan je naam, e-mail of een account, want die zijn er niet.</> },
      { title: 'Technische gegevens', body: <>Om misbruik te voorkomen gebruiken we je IP-adres kort om feedback te beperken (één melding per stad per uur). Het wordt alleen in het geheugen gebruikt voor die controle en niet samen met je feedback opgeslagen.</> },
      { title: 'Analyse', body: <>We gebruiken <A href={PLAUSIBLE}>Plausible Analytics</A>, een privacyvriendelijke tool die in de EU wordt gehost en bezoeken telt <strong>zonder cookies</strong> en zonder persoonsgegevens te verzamelen. We zien alleen totalen (bijv. paginaweergaven), nooit personen. Daarnaast gebruiken we <strong>Vercel Speed Insights</strong>, dat meet hoe snel pagina’s laden (anonieme prestatiecijfers zoals laadtijd), eveneens zonder cookies en zonder je te identificeren.</> },
      { title: 'Diensten van derden', body: <>
        <p className="mb-2">Om een verwachting te maken sturen we de stad of coördinaten die je zoekt naar weer- en geocodingdiensten, en krijgen we hun gegevens terug:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocoding, luchtkwaliteit, historisch archief)</li>
          <li>Photon (komoot) en OpenStreetMap — zoeken naar toppen en tophoogtes: de zoektekst en, met „In de buurt”, een locatie afgerond op ongeveer 10 km; voor gemarkeerde routes stuurt onze server alleen de coördinaten van de top</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (VS), Bright Sky (DWD), SMHI — plus ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — alleen als je „mijn locatie” gebruikt, om je coördinaten om te zetten in een plaatsnaam (reverse geocoding)</li>
          <li>NOAA Aviation Weather (METAR-rapporten) en Meteostat — krijgen op de server stadscoördinaten om referentiemetingen op te halen waarmee de nauwkeurigheid van elke bron wordt beoordeeld</li>
          <li>Kaarttegels van OpenStreetMap-bijdragers (heatmap en regenradar) en OpenTopoMap (routekaarten in de app)</li>
        </ul>
        <p className="mt-2">De app wordt gehost bij <strong>Vercel</strong> en de database draait bij <strong>Supabase</strong> (EU-regio, Frankfurt). Elke aanbieder verwerkt de ontvangen gegevens volgens zijn eigen privacybeleid.</p>
      </> },
      { title: 'Meldingen (app)', body: <>Als je meldingen aanzet in de app, bewaren we het pushtoken van je telefoon (van Apple of Google), een hash van een willekeurige sleutel die de app aanmaakt, je thuisstad, welke waarschuwingen je hebt aangezet en het uur van je ochtendbericht, geplande toppen en dagen, je taal en eenheid, en een logboek van wat we de afgelopen 14 dagen stuurden. Er is geen account en geen locatie. Telefoons die de app 90 dagen niet hebben geopend, worden automatisch verwijderd, geplande tochten na hun dag. Routes blijven op je telefoon; een route waarop je een tocht plant, wordt met het plan opgeslagen om de meldingen te sturen en samen ermee verwijderd. Meldingen uitzetten in de app of de app verwijderen stopt ze.</> },
      { title: 'Hoe lang we het bewaren', body: <>Opgeslagen verwachtingen en interne administratie worden automatisch verwijderd door een dagelijkse opschoning (meestal binnen ongeveer 48 uur); consensus-momentopnames en serverfoutlogs worden na 30 dagen verwijderd. Feedbackmeldingen van de community bewaren we zolang ze de openbare nauwkeurigheidskaart en de langetermijnranglijst van bronnen voeden — of tot je ons vraagt ze te verwijderen (zie hieronder). Totale nauwkeurigheidsgewichten zijn anoniem en worden onbeperkt bewaard.</> },
      { title: 'Jouw keuzes', body: <>Je kunt de app gebruiken zonder je locatie te delen, je lokaal opgeslagen voorkeuren altijd wissen en verwijdering van feedbackgegevens aanvragen door een issue te openen in onze <A href={ISSUES}>GitHub-repository</A>.</> },
      { title: 'Contact', body: <>Vragen over privacy? Mail naar <A href="mailto:info@metablend.app">info@metablend.app</A> of open een issue op <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. Naarmate MetaBlend zich ontwikkelt, kan deze verklaring veranderen; de datum „laatst bijgewerkt” hierboven geeft altijd de actuele versie aan.</> },
    ],
  },
  pl: {
    updated: 'Ostatnia aktualizacja: październik 2026',
    t1: 'Polityka ', t2: 'prywatności',
    intro: <><em className="text-zinc-500">To jest tłumaczenie; w razie rozbieżności obowiązuje wersja angielska.</em><br /><br />MetaBlend to darmowa, rozwijana aplikacja pogodowa <strong>bez kont i bez rejestracji</strong>. Zbieramy tylko te dane, które są potrzebne do działania usługi i do mierzenia, jak dokładne jest każde źródło pogody. To podsumowanie prostym językiem, a nie porada prawna.</>,
    sections: [
      { title: 'Co zostaje na twoim urządzeniu', body: <>Przechowujemy lokalnie kilka drobnych ustawień, aby aplikacja pamiętała twoje wybory: język, jednostkę temperatury, wygląd, wybrany zakres prognozy, twoją zgodę na tę politykę oraz ostatnio wyszukiwane i zapisane miasta. Ostatnio oglądana prognoza jest zapisywana, aby aplikacja działała offline. Nic z tego nie opuszcza twojej przeglądarki i możesz to w każdej chwili usunąć, czyszcząc dane witryny.</> },
      { title: 'Opinie o pogodzie, które wysyłasz', body: <>Gdy zgłaszasz „jaka jest teraz pogoda”, zapisujemy miasto, podaną temperaturę i warunki, datę oraz przybliżone współrzędne wyszukanego miasta (z naszego geokodera — nigdy pozycję GPS twojego urządzenia). Służy to ocenie, jak blisko prawdy było każde źródło, a zgłoszenia pojawiają się jako punkty na poziomie miast na publicznej mapie dokładności. Nie są powiązane z twoim imieniem, e-mailem ani kontem, bo takich nie ma.</> },
      { title: 'Dane techniczne', body: <>Aby zapobiegać nadużyciom, na krótko używamy twojego adresu IP do ograniczania opinii (jedno zgłoszenie na miasto na godzinę). Jest on używany w pamięci tylko do tego sprawdzenia i nie jest zapisywany razem z opinią.</> },
      { title: 'Analityka', body: <>Korzystamy z <A href={PLAUSIBLE}>Plausible Analytics</A>, przyjaznego prywatności narzędzia hostowanego w UE, które liczy wizyty <strong>bez plików cookie</strong> i bez zbierania danych osobowych. Widzimy tylko liczby zbiorcze (np. odsłony), nigdy pojedyncze osoby. Używamy też <strong>Vercel Speed Insights</strong>, które mierzy szybkość ładowania stron (anonimowe dane o wydajności, np. czas ładowania), również bez plików cookie i bez identyfikowania cię.</> },
      { title: 'Usługi zewnętrzne', body: <>
        <p className="mb-2">Aby przygotować prognozę, wysyłamy wyszukiwane miasto lub współrzędne do dostawców danych pogodowych i geokodowania, a oni odsyłają nam swoje dane:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (w tym geokodowanie, jakość powietrza, archiwum historyczne)</li>
          <li>Photon (komoot) i OpenStreetMap — wyszukiwanie szczytów i ich wysokości: wyszukiwany tekst oraz, przy „W pobliżu”, lokalizacja zaokrąglona do ok. 10 km; dla oznakowanych tras nasz serwer wysyła tylko współrzędne szczytu</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (USA), Bright Sky (DWD), SMHI — oraz ECMWF/GFS/ICON przez Open-Meteo</li>
          <li>BigDataCloud — tylko gdy używasz „mojej lokalizacji”, aby zamienić współrzędne na nazwę miasta (odwrotne geokodowanie)</li>
          <li>NOAA Aviation Weather (raporty METAR) i Meteostat — otrzymują po stronie serwera współrzędne miast, aby pobrać pomiary referencyjne do oceny dokładności źródeł</li>
          <li>Kafelki map od współtwórców OpenStreetMap (mapa cieplna i radar opadów) oraz OpenTopoMap (mapy tras w aplikacji)</li>
        </ul>
        <p className="mt-2">Aplikacja jest hostowana w <strong>Vercel</strong>, a jej baza danych działa w <strong>Supabase</strong> (region UE, Frankfurt). Każdy dostawca przetwarza otrzymane dane zgodnie z własną polityką prywatności.</p>
      </> },
      { title: 'Powiadomienia (aplikacja)', body: <>Jeśli włączysz powiadomienia w aplikacji, zapisujemy token push twojego telefonu (od Apple lub Google), skrót losowego klucza tworzonego przez aplikację, twoje miasto domowe, włączone ostrzeżenia i godzinę porannego przeglądu, zaplanowane szczyty i dni, język i jednostkę oraz dziennik tego, co wysłaliśmy w ostatnich 14 dniach. Nie ma konta ani lokalizacji. Telefony, które nie otworzyły aplikacji przez 90 dni, są usuwane automatycznie, a zaplanowane wędrówki po ich dniu. Trasy zostają na twoim telefonie; trasa, na której planujesz wędrówkę, jest zapisywana razem z planem, aby wysłać jej powiadomienia, i usuwana wraz z nim. Wyłączenie powiadomień w aplikacji lub jej usunięcie je zatrzymuje.</> },
      { title: 'Jak długo przechowujemy dane', body: <>Zapisane prognozy i wewnętrzne wpisy porządkowe są automatycznie usuwane przez codzienne czyszczenie (zwykle w ciągu ok. 48 godzin); migawki konsensusu i logi błędów serwera są usuwane po 30 dniach. Opinie społeczności przechowujemy tak długo, jak zasilają publiczną mapę dokładności i długoterminowe rankingi źródeł — lub do czasu, aż poprosisz o ich usunięcie (patrz niżej). Zbiorcze wagi dokładności są anonimowe i przechowywane bezterminowo.</> },
      { title: 'Twoje wybory', body: <>Możesz korzystać z aplikacji bez udostępniania lokalizacji, w każdej chwili usunąć lokalnie zapisane ustawienia i poprosić o usunięcie danych z opinii, zgłaszając sprawę w naszym <A href={ISSUES}>repozytorium GitHub</A>.</> },
      { title: 'Kontakt', body: <>Pytania o prywatność? Napisz na <A href="mailto:info@metablend.app">info@metablend.app</A> lub zgłoś sprawę na <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. W miarę rozwoju MetaBlend ta polityka może się zmieniać; data „ostatniej aktualizacji” powyżej zawsze wskazuje aktualną wersję.</> },
    ],
  },
  cs: {
    updated: 'Naposledy aktualizováno v říjnu 2026',
    t1: 'Ochrana ', t2: 'soukromí',
    intro: <><em className="text-zinc-500">Toto je překlad; pokud se verze liší, platí anglická verze.</em><br /><br />MetaBlend je bezplatná aplikace o počasí ve vývoji <strong>bez účtů a bez registrace</strong>. Sbíráme jen data nezbytná pro provoz služby a pro měření přesnosti jednotlivých zdrojů počasí. Toto je shrnutí srozumitelným jazykem, nikoli právní rada.</>,
    sections: [
      { title: 'Co zůstává ve vašem zařízení', body: <>Lokálně ukládáme několik drobných nastavení, aby si aplikace pamatovala vaše volby: jazyk, jednotku teploty, vzhled, zvolený rozsah předpovědi, váš souhlas s tímto oznámením a nedávno hledaná a uložená města. Naposledy zobrazená předpověď se ukládá, aby aplikace fungovala i offline. Nic z toho neopouští váš prohlížeč a kdykoli to smažete vymazáním dat webu.</> },
      { title: 'Zpětná vazba k počasí, kterou odešlete', body: <>Když nahlásíte „jaké je teď počasí“, uložíme město, zadanou teplotu a stav, datum a přibližné souřadnice hledaného města (z našeho geokodéru — nikdy polohu GPS vašeho zařízení). Slouží to k hodnocení, jak blízko byl každý zdroj, a hlášení se zobrazují jako body na úrovni měst na veřejné mapě přesnosti. Nejsou spojena s vaším jménem, e-mailem ani účtem, protože žádné nejsou.</> },
      { title: 'Technická data', body: <>Abychom zabránili zneužití, krátce používáme vaši IP adresu k omezení zpětné vazby (jedno hlášení na město za hodinu). Používá se jen v paměti pro tuto kontrolu a neukládá se spolu se zpětnou vazbou.</> },
      { title: 'Analytika', body: <>Používáme <A href={PLAUSIBLE}>Plausible Analytics</A>, nástroj šetrný k soukromí hostovaný v EU, který počítá návštěvy <strong>bez souborů cookie</strong> a bez sběru osobních údajů. Vidíme jen souhrnná čísla (např. zobrazení stránek), nikdy jednotlivce. Používáme také <strong>Vercel Speed Insights</strong>, které měří, jak rychle se stránky načítají (anonymní údaje o výkonu, např. dobu načtení), rovněž bez cookie a bez vaší identifikace.</> },
      { title: 'Služby třetích stran', body: <>
        <p className="mb-2">Pro sestavení předpovědi posíláme hledané město nebo souřadnice poskytovatelům dat o počasí a geokódování a dostáváme zpět jejich data:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (vč. geokódování, kvality ovzduší, historického archivu)</li>
          <li>Photon (komoot) a OpenStreetMap — hledání vrcholů a jejich výšek: hledaný text a u „Poblíž“ poloha zaokrouhlená asi na 10 km; pro značené trasy náš server posílá jen souřadnice vrcholu</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (USA), Bright Sky (DWD), SMHI — a ECMWF/GFS/ICON přes Open-Meteo</li>
          <li>BigDataCloud — jen pokud použijete „moji polohu“, k převodu souřadnic na název města (reverzní geokódování)</li>
          <li>NOAA Aviation Weather (hlášení METAR) a Meteostat — dostávají na serveru souřadnice měst, aby získaly referenční měření pro hodnocení přesnosti zdrojů</li>
          <li>Mapové dlaždice od přispěvatelů OpenStreetMap (teplotní mapa a srážkový radar) a OpenTopoMap (mapy tras v aplikaci)</li>
        </ul>
        <p className="mt-2">Aplikace běží na <strong>Vercel</strong> a její databáze na <strong>Supabase</strong> (region EU, Frankfurt). Každý poskytovatel zpracovává data, která obdrží, podle vlastních zásad ochrany soukromí.</p>
      </> },
      { title: 'Oznámení (aplikace)', body: <>Pokud v aplikaci zapnete oznámení, uložíme push token vašeho telefonu (od Apple nebo Google), hash náhodného klíče, který aplikace vytvoří, vaše domovské město, zapnutá upozornění a hodinu ranního přehledu, plánované vrcholy a dny, jazyk a jednotku a záznam toho, co jsme odeslali za posledních 14 dní. Neexistuje účet ani poloha. Telefony, které aplikaci 90 dní neotevřely, se automaticky mažou, plánované túry po jejich dni. Trasy zůstávají ve vašem telefonu; trasa, na které plánujete túru, se uloží s plánem kvůli odeslání upozornění a smaže se spolu s ním. Vypnutím oznámení v aplikaci nebo smazáním aplikace je zastavíte.</> },
      { title: 'Jak dlouho data uchováváme', body: <>Uložené předpovědi a interní evidenční záznamy maže automaticky denní úklid (obvykle do zhruba 48 hodin); snímky konsenzu a chybové logy serveru se mažou po 30 dnech. Zpětnou vazbu komunity uchováváme, dokud slouží veřejné mapě přesnosti a dlouhodobému žebříčku zdrojů — nebo dokud nás nepožádáte o její odstranění (viz níže). Souhrnné váhy přesnosti jsou anonymní a uchovávají se natrvalo.</> },
      { title: 'Vaše volby', body: <>Aplikaci můžete používat bez sdílení polohy, kdykoli smazat lokálně uložená nastavení a požádat o odstranění dat zpětné vazby otevřením issue v našem <A href={ISSUES}>repozitáři na GitHubu</A>.</> },
      { title: 'Kontakt', body: <>Otázky k soukromí? Napište na <A href="mailto:info@metablend.app">info@metablend.app</A> nebo otevřete issue na <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. S vývojem MetaBlend se toto oznámení může měnit; datum „naposledy aktualizováno“ výše vždy odpovídá aktuální verzi.</> },
    ],
  },
  sl: {
    updated: 'Zadnja posodobitev: oktober 2026',
    t1: 'Varstvo ', t2: 'zasebnosti',
    intro: <><em className="text-zinc-500">To je prevod; če se različici razlikujeta, velja angleška različica.</em><br /><br />MetaBlend je brezplačna vremenska aplikacija v razvoju <strong>brez računov in brez prijave</strong>. Zbiramo le podatke, ki so potrebni za delovanje storitve in za merjenje natančnosti posameznih vremenskih virov. To je povzetek v preprostem jeziku, ne pravni nasvet.</>,
    sections: [
      { title: 'Kaj ostane na tvoji napravi', body: <>Lokalno shranimo nekaj majhnih nastavitev, da si aplikacija zapomni tvoje izbire: jezik, enoto temperature, videz, izbrano obdobje napovedi, tvojo privolitev v to obvestilo ter nedavno iskana in shranjena mesta. Zadnja ogledana napoved se shrani, da aplikacija deluje tudi brez povezave. Nič od tega ne zapusti tvojega brskalnika in vse lahko kadarkoli izbrišeš z brisanjem podatkov spletnega mesta.</> },
      { title: 'Vremenski odzivi, ki jih pošlješ', body: <>Ko sporočiš »kakšno je vreme zdaj«, shranimo mesto, vneseno temperaturo in stanje, datum in približne koordinate iskanega mesta (iz našega geokoderja — nikoli položaja GPS tvoje naprave). To uporabimo za oceno, kako blizu je bil posamezen vir, poročila pa se prikažejo kot točke na ravni mest na javnem zemljevidu natančnosti. Niso povezana s tvojim imenom, e-pošto ali računom, ker teh ni.</> },
      { title: 'Tehnični podatki', body: <>Da preprečimo zlorabe, za kratek čas uporabimo tvoj naslov IP za omejevanje odzivov (eno poročilo na mesto na uro). Uporablja se le v pomnilniku za to preverjanje in se ne shrani skupaj z odzivom.</> },
      { title: 'Analitika', body: <>Uporabljamo <A href={PLAUSIBLE}>Plausible Analytics</A>, zasebnosti prijazno orodje, gostovano v EU, ki šteje obiske <strong>brez piškotkov</strong> in brez zbiranja osebnih podatkov. Vidimo le skupne številke (npr. oglede strani), nikoli posameznikov. Uporabljamo tudi <strong>Vercel Speed Insights</strong>, ki meri, kako hitro se strani naložijo (anonimni podatki o zmogljivosti, npr. čas nalaganja), prav tako brez piškotkov in brez tvoje identifikacije.</> },
      { title: 'Storitve tretjih oseb', body: <>
        <p className="mb-2">Za pripravo napovedi pošljemo iskano mesto ali koordinate ponudnikom vremenskih podatkov in geokodiranja ter od njih prejmemo podatke:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (vklj. geokodiranje, kakovost zraka, zgodovinski arhiv)</li>
          <li>Photon (komoot) in OpenStreetMap — iskanje vrhov in njihovih višin: iskano besedilo in pri »V bližini« lokacija, zaokrožena na približno 10 km; za označene poti naš strežnik pošlje le koordinate vrha</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (ZDA), Bright Sky (DWD), SMHI — ter ECMWF/GFS/ICON prek Open-Meteo</li>
          <li>BigDataCloud — le če uporabiš »mojo lokacijo«, da koordinate pretvori v ime mesta (obratno geokodiranje)</li>
          <li>NOAA Aviation Weather (poročila METAR) in Meteostat — na strežniku prejmeta koordinate mest, da pridobita referenčne meritve za oceno natančnosti virov</li>
          <li>Ploščice zemljevidov sodelavcev OpenStreetMap (toplotni zemljevid in radar padavin) ter OpenTopoMap (zemljevidi poti v aplikaciji)</li>
        </ul>
        <p className="mt-2">Aplikacija gostuje pri <strong>Vercel</strong>, njena podatkovna baza pa teče pri <strong>Supabase</strong> (regija EU, Frankfurt). Vsak ponudnik obdeluje prejete podatke po svoji politiki zasebnosti.</p>
      </> },
      { title: 'Obvestila (aplikacija)', body: <>Če v aplikaciji vklopiš obvestila, shranimo potisni žeton tvojega telefona (od Apple ali Google), zgoščeno vrednost naključnega ključa, ki ga ustvari aplikacija, tvoj domači kraj, vklopljena opozorila in uro jutranjega pregleda, načrtovane vrhove in dneve, jezik in enoto ter dnevnik poslanega v zadnjih 14 dneh. Ni računa in ni lokacije. Telefoni, ki aplikacije niso odprli 90 dni, se samodejno izbrišejo, načrtovane ture pa po njihovem dnevu. Poti ostanejo na tvojem telefonu; pot, na kateri načrtuješ turo, se shrani z načrtom za pošiljanje obvestil in se izbriše skupaj z njim. Izklop obvestil v aplikaciji ali izbris aplikacije jih ustavi.</> },
      { title: 'Kako dolgo hranimo podatke', body: <>Shranjene napovedi in notranje evidenčne vrstice samodejno izbriše dnevno čiščenje (običajno v približno 48 urah); posnetki soglasja in dnevniki napak strežnika se izbrišejo po 30 dneh. Odzive skupnosti hranimo, dokler poganjajo javni zemljevid natančnosti in dolgoročno lestvico virov — ali dokler nas ne prosiš za izbris (glej spodaj). Skupne uteži natančnosti so anonimne in se hranijo trajno.</> },
      { title: 'Tvoje izbire', body: <>Aplikacijo lahko uporabljaš brez deljenja lokacije, kadarkoli izbrišeš lokalno shranjene nastavitve in zahtevaš izbris podatkov odzivov z odprtjem zadeve v našem <A href={ISSUES}>repozitoriju GitHub</A>.</> },
      { title: 'Stik', body: <>Vprašanja o zasebnosti? Piši na <A href="mailto:info@metablend.app">info@metablend.app</A> ali odpri zadevo na <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. Z razvojem MetaBlend se to obvestilo lahko spremeni; datum »zadnja posodobitev« zgoraj vedno ustreza trenutni različici.</> },
    ],
  },
  pt: {
    updated: 'Última atualização: outubro de 2026',
    t1: 'Aviso de ', t2: 'privacidade',
    intro: <><em className="text-zinc-500">Esta é uma tradução; se as versões divergirem, vale a versão em inglês.</em><br /><br />O MetaBlend é um app de previsão do tempo gratuito, em desenvolvimento, <strong>sem contas e sem cadastro</strong>. Coletamos apenas os dados necessários para o serviço funcionar e para medir o quão precisa é cada fonte meteorológica. Este é um resumo em linguagem simples, não uma orientação jurídica.</>,
    sections: [
      { title: 'O que fica no seu dispositivo', body: <>Guardamos algumas pequenas preferências localmente para o app lembrar suas escolhas: idioma, unidade de temperatura, aparência, o período de previsão escolhido, seu consentimento a este aviso e as cidades buscadas e salvas recentemente. A última previsão vista fica armazenada para o app funcionar offline. Nada disso sai do seu navegador, e você pode apagar tudo a qualquer momento limpando os dados do site.</> },
      { title: 'Retornos sobre o tempo que você envia', body: <>Quando você informa “como está o tempo agora”, guardamos a cidade, a temperatura e a condição que você inseriu, a data e as coordenadas aproximadas da cidade buscada (do nosso geocodificador — nunca a posição de GPS do seu dispositivo). Isso serve para avaliar o quanto cada fonte acertou, e os relatos aparecem como pontos por cidade no mapa público de precisão. Eles não são ligados ao seu nome, e-mail ou conta, porque não existem.</> },
      { title: 'Dados técnicos', body: <>Para evitar abusos, usamos seu endereço IP por um breve momento para limitar os retornos (um relato por cidade por hora). Ele é usado apenas na memória para essa verificação e não é armazenado junto com o retorno.</> },
      { title: 'Análises', body: <>Usamos o <A href={PLAUSIBLE}>Plausible Analytics</A>, uma ferramenta que respeita a privacidade, hospedada na UE, que conta visitas <strong>sem cookies</strong> e sem coletar dados pessoais. Vemos apenas números agregados (ex.: visualizações de página), nunca pessoas. Também usamos o <strong>Vercel Speed Insights</strong>, que mede a velocidade de carregamento das páginas (números anônimos de desempenho, como tempo de carregamento), também sem cookies e sem identificar você.</> },
      { title: 'Serviços de terceiros', body: <>
        <p className="mb-2">Para gerar uma previsão, enviamos a cidade ou as coordenadas que você busca a provedores de dados meteorológicos e de geocodificação e recebemos os dados deles:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo (incl. geocodificação, qualidade do ar, arquivo histórico)</li>
          <li>Photon (komoot) e OpenStreetMap — busca de picos e altitudes: o texto buscado e, com “Perto de mim”, uma localização arredondada a cerca de 10 km; para rotas sinalizadas, nosso servidor envia apenas as coordenadas do cume</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS (EUA), Bright Sky (DWD), SMHI — além de ECMWF/GFS/ICON via Open-Meteo</li>
          <li>BigDataCloud — só se você usar “minha localização”, para transformar suas coordenadas no nome de uma cidade (geocodificação reversa)</li>
          <li>NOAA Aviation Weather (boletins METAR) e Meteostat — recebem no servidor as coordenadas das cidades para obter medições de referência que avaliam a precisão de cada fonte</li>
          <li>Blocos de mapa dos colaboradores do OpenStreetMap (mapa de calor e radar de chuva) e OpenTopoMap (mapas de rotas no app)</li>
        </ul>
        <p className="mt-2">O app é hospedado na <strong>Vercel</strong> e o banco de dados roda no <strong>Supabase</strong> (região UE, Frankfurt). Cada provedor trata os dados que recebe conforme a própria política de privacidade.</p>
      </> },
      { title: 'Notificações (app)', body: <>Se você ativar as notificações no app, guardamos o token push do seu celular (da Apple ou do Google), um hash de uma chave aleatória criada pelo app, sua cidade de casa, quais alertas você ativou e o horário do resumo da manhã, picos e datas planejados, seu idioma e unidade, e um registro do que enviamos nos últimos 14 dias. Não há conta nem localização. Celulares que não abrem o app há 90 dias são apagados automaticamente, e as trilhas planejadas após o seu dia. As rotas ficam no seu celular; uma rota em que você planeja uma trilha é guardada junto com o plano para enviar os alertas e apagada com ele. Desativar as notificações no app ou apagar o app as interrompe.</> },
      { title: 'Por quanto tempo guardamos', body: <>Previsões armazenadas e registros internos são apagados automaticamente por uma limpeza diária (em geral em cerca de 48 horas); instantâneos do consenso e logs de erro do servidor são apagados após 30 dias. Os retornos da comunidade são mantidos enquanto alimentam o mapa público de precisão e o ranking de longo prazo das fontes — ou até você pedir a remoção (veja abaixo). Pesos de precisão agregados são anônimos e guardados por tempo indeterminado.</> },
      { title: 'Suas escolhas', body: <>Você pode usar o app sem compartilhar sua localização, apagar suas preferências locais a qualquer momento e pedir a remoção de dados de retorno abrindo uma issue no nosso <A href={ISSUES}>repositório no GitHub</A>.</> },
      { title: 'Contato', body: <>Dúvidas sobre privacidade? Escreva para <A href="mailto:info@metablend.app">info@metablend.app</A> ou abra uma issue em <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>. Conforme o MetaBlend evolui, este aviso pode mudar; a data de “última atualização” acima sempre indica a versão atual.</> },
    ],
  },
  ja: {
    updated: '最終更新：2026年10月',
    t1: 'プライバシー', t2: 'ポリシー',
    intro: <><em className="text-zinc-500">これは翻訳です。内容に相違がある場合は英語版が優先されます。</em><br /><br />MetaBlendは開発中の無料天気アプリで、<strong>アカウントも登録も不要</strong>です。サービスの運営と、各気象ソースの精度の測定に必要な最小限のデータだけを集めています。これはわかりやすい言葉でまとめた概要であり、法的な助言ではありません。</>,
    sections: [
      { title: '端末に保存されるもの', body: <>アプリが選択内容を覚えておけるよう、いくつかの小さな設定を端末に保存します：言語、温度の単位、外観、選択した予報期間、このポリシーへの同意、最近検索・保存した都市。最後に表示した予報はオフラインでも使えるよう保存されます。これらはブラウザの外に出ることはなく、サイトデータを消去すればいつでも削除できます。</> },
      { title: '送信された天気のフィードバック', body: <>「今の天気」を報告すると、都市、入力された気温と天気、日付、検索した都市のおおよその座標（ジオコーダーによるもので、端末のGPS位置ではありません）を保存します。これは各ソースがどれだけ近かったかの採点に使い、報告は公開の精度ヒートマップに都市単位の点として表示されます。名前、メールアドレス、アカウントとは結び付けられません。そもそもそれらは存在しないからです。</> },
      { title: '技術的なデータ', body: <>不正利用を防ぐため、フィードバックの回数制限（1都市につき1時間に1件）にIPアドレスを一時的に使用します。このチェックのためにメモリ上でのみ使われ、フィードバックと一緒に保存されることはありません。</> },
      { title: 'アクセス解析', body: <><A href={PLAUSIBLE}>Plausible Analytics</A>を使用しています。EU内でホストされるプライバシーに配慮したツールで、<strong>Cookieを使わず</strong>、個人データを収集せずに訪問数を数えます。私たちに見えるのは集計値（ページビューなど）だけで、個人ではありません。また<strong>Vercel Speed Insights</strong>でページの読み込み速度（読み込み時間などの匿名の性能値）を測定していますが、こちらもCookieを使わず、個人を特定しません。</> },
      { title: '外部サービス', body: <>
        <p className="mb-2">予報を作るために、検索された都市や座標を気象・ジオコーディングのプロバイダーに送り、データを受け取ります：</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo（ジオコーディング、大気質、過去データのアーカイブを含む）</li>
          <li>Photon（komoot）とOpenStreetMap — 山の検索と山頂の標高：検索テキストと、「現在地周辺」の場合は約10 kmに丸めた位置。標識のあるルートについては、サーバーが山頂の座標だけを送ります</li>
          <li>MET Norway、OpenWeatherMap、WeatherAPI、Tomorrow.io、Visual Crossing、World Weather Online、Weatherstack、NASA POWER、GeoSphere Austria、NWS（米国）、Bright Sky（DWD）、SMHI — およびOpen-Meteo経由のECMWF/GFS/ICON</li>
          <li>BigDataCloud — 「現在地」を使う場合のみ、座標を都市名に変換するため（逆ジオコーディング）</li>
          <li>NOAA Aviation Weather（METAR通報）とMeteostat — 各ソースの精度を採点する基準測定値を取得するため、サーバー側で都市の座標を受け取ります</li>
          <li>OpenStreetMap contributorsによる地図タイル（ヒートマップと雨雲レーダー）とOpenTopoMap（アプリ内のルート地図）</li>
        </ul>
        <p className="mt-2">アプリは<strong>Vercel</strong>でホストされ、データベースは<strong>Supabase</strong>（EUリージョン、フランクフルト）で稼働しています。各プロバイダーは受け取ったデータをそれぞれのプライバシーポリシーに従って扱います。</p>
      </> },
      { title: '通知（アプリ）', body: <>アプリで通知をオンにすると、スマートフォンのプッシュトークン（AppleまたはGoogle発行）、アプリが作成するランダムなキーのハッシュ、ホームの都市、オンにしたアラートと朝のお知らせの時刻、計画した山と日付、言語と単位、過去14日間に送信した内容の記録を保存します。アカウントも位置情報もありません。90日間アプリを開いていない端末は自動的に削除され、計画した登山はその日を過ぎると削除されます。ルートはスマートフォンに保存されます。登山を計画したルートは、通知を送るために計画と一緒に保存され、計画とともに削除されます。アプリで通知をオフにするか、アプリを削除すると通知は止まります。</> },
      { title: '保存期間', body: <>保存された予報と内部の管理用データは、毎日の自動クリーンアップで削除されます（通常は約48時間以内）。コンセンサスのスナップショットとサーバーのエラーログは30日後に削除されます。コミュニティのフィードバックは、公開の精度ヒートマップと長期的なソースランキングに使われている間、またはあなたから削除の依頼があるまで保存します（下記参照）。集計された精度の重みは匿名で、無期限に保存されます。</> },
      { title: 'あなたの選択', body: <>位置情報を共有せずにアプリを使うことも、端末に保存された設定をいつでも消去することもできます。フィードバックデータの削除は、<A href={ISSUES}>GitHubリポジトリ</A>でissueを作成して依頼できます。</> },
      { title: 'お問い合わせ', body: <>プライバシーについてのご質問は<A href="mailto:info@metablend.app">info@metablend.app</A>までメールいただくか、<A href={ISSUES}>github.com/NeverFirstTry/metablend</A>でissueを作成してください。MetaBlendの発展に伴いこのポリシーは変更されることがあります。上記の「最終更新」日が常に最新版を示します。</> },
    ],
  },
  zh: {
    updated: '最后更新：2026 年 10 月',
    t1: '隐私', t2: '声明',
    intro: <><em className="text-zinc-500">本文为译文；如各版本有出入，以英文版为准。</em><br /><br />MetaBlend 是一款免费、仍在开发中的天气应用，<strong>无需账号，无需注册</strong>。我们只收集运行服务和衡量各天气来源准确度所需的最少数据。这是一份通俗的概述，并非法律建议。</>,
    sections: [
      { title: '保存在你设备上的内容', body: <>我们在本地保存少量偏好设置，让应用记住你的选择：语言、温度单位、外观、所选预报范围、你对本声明的同意，以及最近搜索和保存的城市。你最后查看的预报会被缓存，以便离线使用。这些内容都不会离开你的浏览器，你随时可以通过清除网站数据来删除。</> },
      { title: '你提交的天气反馈', body: <>当你报告“现在天气怎么样”时，我们会保存城市、你输入的温度和天气状况、日期，以及所搜索城市的大致地图坐标（来自我们的地理编码服务，绝不是你设备的 GPS 位置）。这些数据用于评估各来源的准确程度，报告会以城市级的点显示在公开的准确度热力图上。它们不会与你的姓名、邮箱或账号关联，因为这些都不存在。</> },
      { title: '技术数据', body: <>为防止滥用，我们会短暂使用你的 IP 地址来限制反馈频率（每个城市每小时一条）。它只在内存中用于这项检查，不会与你的反馈一起保存。</> },
      { title: '统计分析', body: <>我们使用 <A href={PLAUSIBLE}>Plausible Analytics</A>，这是一款注重隐私、托管于欧盟的工具，<strong>不使用 Cookie</strong>、不收集个人数据即可统计访问量。我们只能看到汇总数字（例如页面浏览量），看不到个人。我们还使用 <strong>Vercel Speed Insights</strong> 衡量页面加载速度（加载时间等匿名性能数据），同样不使用 Cookie，也不会识别你的身份。</> },
      { title: '第三方服务', body: <>
        <p className="mb-2">为生成预报，我们会把你搜索的城市或坐标发送给天气和地理编码服务商，并接收它们返回的数据：</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo（含地理编码、空气质量、历史档案）</li>
          <li>Photon（komoot）和 OpenStreetMap — 山峰搜索和山顶高度：搜索文本，以及使用“我附近”时精确到约 10 公里的位置；对于有标记的路线，我们的服务器只发送山顶坐标</li>
          <li>MET Norway、OpenWeatherMap、WeatherAPI、Tomorrow.io、Visual Crossing、World Weather Online、Weatherstack、NASA POWER、GeoSphere Austria、NWS（美国）、Bright Sky（DWD）、SMHI — 以及通过 Open-Meteo 获取的 ECMWF/GFS/ICON</li>
          <li>BigDataCloud — 仅在你使用“我的位置”时，用于把坐标转换为城市名（逆地理编码）</li>
          <li>NOAA Aviation Weather（METAR 报告）和 Meteostat — 在服务器端接收城市坐标，用于获取评估各来源准确度的参考测量值</li>
          <li>OpenStreetMap 贡献者提供的地图瓦片（热力图和降雨雷达）以及 OpenTopoMap（应用中的路线地图）</li>
        </ul>
        <p className="mt-2">应用托管在 <strong>Vercel</strong>，数据库运行在 <strong>Supabase</strong>（欧盟区域，法兰克福）。各服务商按照各自的隐私政策处理所收到的数据。</p>
      </> },
      { title: '通知（应用）', body: <>如果你在应用中开启通知，我们会保存你手机的推送令牌（来自 Apple 或 Google）、应用生成的随机密钥的哈希值、你的常住城市、你开启的提醒和早间简报时间、计划的山峰和日期、你的语言和单位，以及过去 14 天发送记录。没有账号，也没有位置信息。90 天未打开应用的手机会被自动删除，计划的徒步在其日期过后删除。路线保存在你的手机上；你计划徒步的路线会随计划一起保存以便发送提醒，并随计划一起删除。在应用中关闭通知或删除应用即可停止通知。</> },
      { title: '保存多久', body: <>保存的预报和内部记录由每日清理任务自动删除（通常约 48 小时内）；共识快照和服务器错误日志在 30 天后删除。社区反馈会一直保留，只要它们仍用于公开的准确度热力图和长期来源排名 — 或直到你要求删除（见下文）。汇总的准确度权重是匿名的，会无限期保留。</> },
      { title: '你的选择', body: <>你可以在不分享位置的情况下使用本应用，随时清除本地保存的偏好，也可以在我们的 <A href={ISSUES}>GitHub 仓库</A>提交 issue，要求删除反馈数据。</> },
      { title: '联系我们', body: <>有隐私方面的问题？请发邮件至 <A href="mailto:info@metablend.app">info@metablend.app</A>，或在 <A href={ISSUES}>github.com/NeverFirstTry/metablend</A> 提交 issue。随着 MetaBlend 的发展，本声明可能会更新；上方的“最后更新”日期始终对应当前版本。</> },
    ],
  },
  ko: {
    updated: '최종 업데이트: 2026년 10월',
    t1: '개인정보 ', t2: '처리방침',
    intro: <><em className="text-zinc-500">이 문서는 번역본이며, 내용이 다를 경우 영어 원문이 우선합니다.</em><br /><br />MetaBlend는 개발 중인 무료 날씨 앱으로, <strong>계정도 가입도 필요 없어요</strong>. 서비스를 운영하고 각 기상 출처의 정확도를 측정하는 데 필요한 최소한의 데이터만 수집해요. 이 문서는 쉬운 말로 정리한 요약이며 법률 자문이 아니에요.</>,
    sections: [
      { title: '기기에 남는 정보', body: <>앱이 선택을 기억할 수 있도록 몇 가지 작은 설정을 기기에 저장해요: 언어, 온도 단위, 화면 모드, 선택한 예보 기간, 이 방침에 대한 동의, 최근 검색하고 저장한 도시. 마지막으로 본 예보는 오프라인에서도 쓸 수 있도록 저장돼요. 이 정보는 브라우저 밖으로 나가지 않으며, 사이트 데이터를 지우면 언제든 삭제할 수 있어요.</> },
      { title: '보내 주신 날씨 피드백', body: <>“지금 날씨”를 보고하면 도시, 입력한 기온과 날씨 상태, 날짜, 검색한 도시의 대략적인 지도 좌표(지오코더에서 가져온 것으로, 기기의 GPS 위치는 절대 아님)를 저장해요. 이는 각 출처가 얼마나 정확했는지 채점하는 데 쓰이며, 보고는 공개 정확도 히트맵에 도시 단위의 점으로 표시돼요. 이름, 이메일, 계정과는 연결되지 않아요. 애초에 그런 것이 없으니까요.</> },
      { title: '기술 데이터', body: <>남용을 막기 위해 피드백 횟수 제한(도시당 1시간에 1건)에 IP 주소를 잠시 사용해요. 이 확인을 위해 메모리에서만 쓰이고, 피드백과 함께 저장되지 않아요.</> },
      { title: '분석', body: <><A href={PLAUSIBLE}>Plausible Analytics</A>를 사용해요. EU에서 호스팅되는 개인정보 친화적인 도구로, <strong>쿠키 없이</strong> 개인정보를 수집하지 않고 방문 수를 세요. 저희는 합계(예: 페이지 조회수)만 볼 수 있고 개인은 볼 수 없어요. 또한 <strong>Vercel Speed Insights</strong>로 페이지 로딩 속도(로딩 시간 같은 익명의 성능 수치)를 측정하는데, 이 역시 쿠키를 쓰지 않고 사용자를 식별하지 않아요.</> },
      { title: '외부 서비스', body: <>
        <p className="mb-2">예보를 만들기 위해 검색한 도시나 좌표를 날씨·지오코딩 제공업체에 보내고 데이터를 받아요:</p>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
          <li>Open-Meteo(지오코딩, 대기질, 과거 기록 포함)</li>
          <li>Photon(komoot)과 OpenStreetMap — 산 검색과 정상 고도: 검색어와, “내 주변” 사용 시 약 10 km로 반올림한 위치. 표시된 경로의 경우 서버는 정상 좌표만 보내요</li>
          <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria, NWS(미국), Bright Sky(DWD), SMHI — 그리고 Open-Meteo를 통한 ECMWF/GFS/ICON</li>
          <li>BigDataCloud — “내 위치”를 사용할 때만, 좌표를 도시 이름으로 바꾸기 위해(역지오코딩)</li>
          <li>NOAA Aviation Weather(METAR 보고)와 Meteostat — 각 출처의 정확도를 채점할 기준 측정값을 가져오기 위해 서버에서 도시 좌표를 받아요</li>
          <li>OpenStreetMap 기여자의 지도 타일(히트맵과 강수 레이더)과 OpenTopoMap(앱의 경로 지도)</li>
        </ul>
        <p className="mt-2">앱은 <strong>Vercel</strong>에서 호스팅되고 데이터베이스는 <strong>Supabase</strong>(EU 리전, 프랑크푸르트)에서 운영돼요. 각 제공업체는 받은 데이터를 자체 개인정보 처리방침에 따라 처리해요.</p>
      </> },
      { title: '알림(앱)', body: <>앱에서 알림을 켜면 휴대폰의 푸시 토큰(Apple 또는 Google 발급), 앱이 만든 무작위 키의 해시, 내 도시, 켠 알림과 아침 브리핑 시각, 계획한 산과 날짜, 언어와 단위, 최근 14일간 보낸 내용의 기록을 저장해요. 계정도 위치 정보도 없어요. 90일 동안 앱을 열지 않은 휴대폰은 자동으로 삭제되고, 계획한 등산은 그날이 지나면 삭제돼요. 경로는 휴대폰에 남아요. 등산을 계획한 경로는 알림을 보내기 위해 계획과 함께 저장되고, 계획과 함께 삭제돼요. 앱에서 알림을 끄거나 앱을 삭제하면 알림이 멈춰요.</> },
      { title: '보관 기간', body: <>저장된 예보와 내부 관리용 기록은 매일 실행되는 정리 작업으로 자동 삭제돼요(보통 약 48시간 이내). 합의 스냅숏과 서버 오류 로그는 30일 후 삭제돼요. 커뮤니티 피드백은 공개 정확도 히트맵과 장기 출처 순위에 쓰이는 동안, 또는 삭제를 요청하실 때까지 보관해요(아래 참고). 집계된 정확도 가중치는 익명이며 무기한 보관돼요.</> },
      { title: '사용자의 선택', body: <>위치를 공유하지 않고도 앱을 쓸 수 있고, 기기에 저장된 설정을 언제든 지울 수 있으며, <A href={ISSUES}>GitHub 저장소</A>에 issue를 열어 피드백 데이터 삭제를 요청할 수 있어요.</> },
      { title: '문의', body: <>개인정보 관련 문의는 <A href="mailto:info@metablend.app">info@metablend.app</A>로 메일을 보내거나 <A href={ISSUES}>github.com/NeverFirstTry/metablend</A>에 issue를 열어 주세요. MetaBlend가 발전함에 따라 이 방침은 바뀔 수 있으며, 위의 “최종 업데이트” 날짜가 항상 최신 버전을 나타내요.</> },
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
