import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export const metadata = {
  title: 'Privacy — MetaBlend',
  description: 'What data MetaBlend collects and how it is used.',
}

const UPDATED = 'June 2026'

export default function Privacy() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-1">Privacy<span className="text-emerald-400">Notice</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">Last updated {UPDATED}</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <p className="text-zinc-400">
            MetaBlend is a free, in-development weather app with <strong>no accounts and no sign-up</strong>.
            We keep data collection to the minimum needed to run the service and to measure how accurate
            each weather source is. This is a plain-language summary, not legal advice.
          </p>

          <Section title="What stays on your device">
            We store a few small preferences locally so the app remembers your choices: language, temperature
            unit, your consent to this notice, and your recently searched and saved cities. The last forecast
            you viewed is cached so the app still works offline. None of this leaves your browser, and you can
            clear it anytime by clearing your site data.
          </Section>

          <Section title="Weather feedback you submit">
            When you report “how’s the weather right now,” we store the city, the temperature and condition you
            entered, and the date — and, <em>only if you choose to share your location</em>, approximate
            coordinates. This is used to score how close each weather source was (the leaderboard and heatmap).
            It is not linked to your name, email, or any account, because there are none.
          </Section>

          <Section title="Technical data">
            To stop abuse, we briefly use your IP address to rate-limit feedback (one report per city per hour).
            It is used in memory for that check and is not stored alongside your feedback.
          </Section>

          <Section title="Analytics">
            We use <a href="https://plausible.io/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Plausible Analytics</a>,
            a privacy-friendly, EU-hosted tool that counts visits <strong>without cookies</strong> and without
            collecting personal data. We only see aggregate numbers (e.g. page views), never individuals.
          </Section>

          <Section title="Third-party services">
            <p className="mb-2">To produce a forecast we send the city or coordinates you search to weather and
            geocoding providers, and we receive their data back:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
              <li>Open-Meteo (incl. geocoding, air quality, historical archive)</li>
              <li>MET Norway, OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing,
                  World Weather Online, Weatherstack, NASA POWER, GeoSphere Austria</li>
              <li>BigDataCloud — only if you use “my location”, to turn your
                  coordinates into a city name (reverse geocoding)</li>
              <li>Map tiles by OpenStreetMap contributors (heatmap and rain radar)</li>
            </ul>
            <p className="mt-2">The app is hosted on <strong>Vercel</strong> and its database runs on
            <strong> Supabase</strong> (EU region, Frankfurt). Each provider handles the data it receives under
            its own privacy policy.</p>
          </Section>

          <Section title="How long we keep it">
            Stored forecasts and feedback are automatically deleted by a daily cleanup job (typically within
            about 48 hours), aside from anonymous aggregate accuracy weights.
          </Section>

          <Section title="Your choices">
            You can use the app without sharing your location, clear your locally stored preferences anytime,
            and request removal of feedback data by opening an issue on our
            {' '}<a href="https://github.com/NeverFirstTry/metablend/issues" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">GitHub repository</a>.
          </Section>

          <Section title="Contact">
            Questions about privacy? Open an issue at
            {' '}<a href="https://github.com/NeverFirstTry/metablend/issues" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">github.com/NeverFirstTry/metablend</a>.
            As MetaBlend evolves, this notice may change; the “last updated” date above will always reflect the
            current version.
          </Section>
        </div>

        <Footer />
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
