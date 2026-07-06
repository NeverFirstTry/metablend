'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'

const REPO = 'https://github.com/NeverFirstTry/metablend'
const ISSUES = `${REPO}/issues`

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{children}</a>
)

// The attribution list is identical in every language (proper names + licenses).
function AttributionList() {
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
      <li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">Open-Meteo</a> (CC BY 4.0)</li>
      <li><a href="https://www.met.no" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">MET Norway</a> (NLOD / CC BY 4.0)</li>
      <li>OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack</li>
      <li><a href="https://power.larc.nasa.gov" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">NASA POWER</a> · <a href="https://data.hub.geosphere.at" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">GeoSphere Austria</a></li>
      <li>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">OpenStreetMap</a> (ODbL)</li>
    </ul>
  )
}

// Full terms per language. The substance (disclaimer, license position,
// attribution) must stay identical across languages — change all five together.
const CONTENT = {
  en: {
    updated: 'Last updated July 2026',
    t1: 'Terms', t2: '&Copyright',
    sections: [
      { title: 'Beta — no warranty', body: <>MetaBlend is provided <strong>“as is”</strong>, free of charge, and is under active development. Forecasts blend several third-party sources and may be incomplete, delayed, or wrong. We make no warranty of accuracy, availability, or fitness for any purpose.</> },
      { title: 'Not for safety-critical use', body: <>Do not rely on MetaBlend for decisions where weather accuracy matters to safety — aviation, marine, severe-weather, medical, or similar. Always consult an official meteorological service. We are not liable for any loss or damage arising from use of the app.</> },
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
    updated: 'Zuletzt aktualisiert Juli 2026',
    t1: 'Nutzung', t2: '&Urheberrecht',
    sections: [
      { title: 'Beta — keine Gewährleistung', body: <>MetaBlend wird <strong>„wie besehen“</strong> und kostenlos bereitgestellt und befindet sich in aktiver Entwicklung. Vorhersagen mischen mehrere Drittquellen und können unvollständig, verzögert oder falsch sein. Wir übernehmen keine Gewähr für Genauigkeit, Verfügbarkeit oder Eignung für irgendeinen Zweck.</> },
      { title: 'Nicht für sicherheitskritische Zwecke', body: <>Verlass dich nicht auf MetaBlend, wenn Wettergenauigkeit sicherheitsrelevant ist — Luftfahrt, Seefahrt, Unwetter, Medizin oder Ähnliches. Ziehe immer einen offiziellen Wetterdienst zurate. Wir haften nicht für Verluste oder Schäden aus der Nutzung der App.</> },
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
    updated: 'Dernière mise à jour : juillet 2026',
    t1: 'Conditions', t2: '&Droits',
    sections: [
      { title: 'Bêta — aucune garantie', body: <>MetaBlend est fourni <strong>« en l’état »</strong>, gratuitement, et est en cours de développement actif. Les prévisions mélangent plusieurs sources tierces et peuvent être incomplètes, en retard ou erronées. Nous ne garantissons ni l’exactitude, ni la disponibilité, ni l’adéquation à un quelconque usage.</> },
      { title: 'Pas pour un usage critique pour la sécurité', body: <>Ne vous fiez pas à MetaBlend pour des décisions où la précision météo touche à la sécurité — aviation, navigation, phénomènes violents, médical ou similaire. Consultez toujours un service météorologique officiel. Nous déclinons toute responsabilité pour les pertes ou dommages liés à l’utilisation de l’application.</> },
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
    updated: 'Última actualización: julio de 2026',
    t1: 'Términos', t2: '&Derechos',
    sections: [
      { title: 'Beta — sin garantía', body: <>MetaBlend se ofrece <strong>«tal cual»</strong>, de forma gratuita, y está en desarrollo activo. Las previsiones combinan varias fuentes de terceros y pueden ser incompletas, tardías o erróneas. No garantizamos exactitud, disponibilidad ni idoneidad para ningún fin.</> },
      { title: 'No apto para usos críticos de seguridad', body: <>No confíes en MetaBlend para decisiones donde la precisión meteorológica afecte a la seguridad — aviación, navegación, fenómenos severos, medicina o similares. Consulta siempre un servicio meteorológico oficial. No nos hacemos responsables de pérdidas o daños derivados del uso de la app.</> },
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
    updated: 'Ultimo aggiornamento: luglio 2026',
    t1: 'Termini', t2: '&Copyright',
    sections: [
      { title: 'Beta — nessuna garanzia', body: <>MetaBlend è fornito <strong>«così com’è»</strong>, gratuitamente, ed è in sviluppo attivo. Le previsioni combinano diverse fonti di terze parti e possono essere incomplete, in ritardo o errate. Non garantiamo accuratezza, disponibilità o idoneità ad alcuno scopo.</> },
      { title: 'Non per usi critici per la sicurezza', body: <>Non affidarti a MetaBlend per decisioni in cui la precisione meteo riguarda la sicurezza — aviazione, navigazione, eventi severi, ambito medico o simili. Consulta sempre un servizio meteorologico ufficiale. Non rispondiamo di perdite o danni derivanti dall’uso dell’app.</> },
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
}

export default function TermsContent() {
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
