// Two things a German phone showed (remotion-98's screenshots of 2026-11-21, passed on by Fable): the first start
// offered the chip "Vienna" beside "Beispiel: Wien" (the sample cities were fixed English names), and the agreement
// sentence broke a range at its hyphen ("auf 0-" / "2°") at 390 px. The chips now name the cities in the reader's
// language (and still load by the English name), and a range never breaks.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')

test('the sample cities in the reader\'s language', async () => {
  const { default: HomePage } = await import('../app/HomePage.jsx')
  const { exampleFrom } = await import('./landing.js')
  const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
  const forecast = fixture('forecast-vienna.json')
  const page = render(h(HomePage, { pageLang: 'de', example: { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }, peaks: 195 }))
  const start = page.slice(page.indexOf('first-start'), page.indexOf('home-data'))
  for (const name of ['Wien', 'Berlin', 'London', 'New York', 'Tokio']) assert.ok(start.includes(`>${name}</button>`), name)
  assert.ok(!start.includes('>Vienna</button>') && !start.includes('>Tokyo</button>'))
})

test('a range in the agreement sentence never breaks at its hyphen', async () => {
  const { default: NowLine } = await import('../app/components/outlook/NowLine.jsx')
  const src = (temp, v) => ({ apiId: v, temp, condition: 'Clear' })
  const data = { consensus: { temp: 1, feelsLike: -2, confidencePct: 88, rainPct: 0 }, lon: 16.37, sources: [src(0, 'a'), src(1, 'b'), src(2, 'c'), src(1, 'd'), src(1, 'e'), src(2, 'f')] }
  const html = render(h(NowLine, { data, unit: 'C', lang: 'de', showT: x => x }))
  assert.match(html, /<span class="whitespace-nowrap">\d+-\d+°<\/span>/)
})
