import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export const metadata = {
  title: 'Terms & Copyright — MetaBlend',
  description: 'Terms of use, disclaimer, copyright and data attribution for MetaBlend.',
}

const UPDATED = 'June 2026'

export default function Terms() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-1">Terms<span className="text-emerald-400">&amp;Copyright</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">Last updated {UPDATED}</p>

        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          <Section title="Beta — no warranty">
            MetaBlend is provided <strong>“as is”</strong>, free of charge, and is under active development.
            Forecasts blend several third-party sources and may be incomplete, delayed, or wrong. We make no
            warranty of accuracy, availability, or fitness for any purpose.
          </Section>

          <Section title="Not for safety-critical use">
            Do not rely on MetaBlend for decisions where weather accuracy matters to safety — aviation, marine,
            severe-weather, medical, or similar. Always consult an official meteorological service. We are not
            liable for any loss or damage arising from use of the app.
          </Section>

          <Section title="Acceptable use">
            Please don’t abuse the service: no automated scraping, no attempts to overload the APIs, and no
            submitting deliberately false feedback to skew the accuracy rankings.
          </Section>

          <Section title="Copyright">
            © {new Date().getFullYear()} MetaBlend. All rights reserved. The source code is published on
            {' '}<a href="https://github.com/NeverFirstTry/metablend" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">GitHub</a>
            {' '}for transparency only; this does not grant any license to copy, modify, or redistribute it.
            The MetaBlend name and design are the property of their author.
          </Section>

          <Section title="Data sources & attribution">
            <p className="mb-2">Weather and map data are provided by third parties under their own terms; credit to:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-zinc-400">
              <li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">Open-Meteo</a> (CC BY 4.0) — forecast, geocoding, air quality, historical archive</li>
              <li><a href="https://www.met.no" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">MET Norway</a> (NLOD / CC BY 4.0)</li>
              <li>OpenWeatherMap, WeatherAPI, Tomorrow.io, Visual Crossing, World Weather Online, Weatherstack</li>
              <li><a href="https://power.larc.nasa.gov" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">NASA POWER</a> · <a href="https://data.hub.geosphere.at" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">GeoSphere Austria</a></li>
              <li>Map tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">OpenStreetMap</a> contributors (ODbL)</li>
            </ul>
            <p className="mt-2 text-zinc-400">Weather data remains the property of its respective providers and is
            used under their licenses.</p>
          </Section>

          <Section title="Changes">
            These terms may change as the app develops. The “last updated” date above reflects the current
            version. Questions? Open an issue on
            {' '}<a href="https://github.com/NeverFirstTry/metablend/issues" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">GitHub</a>.
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
