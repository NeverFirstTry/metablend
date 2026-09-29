import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summitWind, freezingLevel, stormRisk } from './physics.js'

const P = o => ({ wind10: null, w850: null, w700: null, w600: null, w500: null, w300: null, ...o })

test('summitWind — interpolates between the pressure levels around the summit', () => {
  assert.equal(summitWind(2250, P({ w850: 20, w700: 40 })), 30) // halfway 1500 → 3000 m
  assert.equal(summitWind(3600, P({ w700: 30, w600: 50 })), 40) // halfway 3000 → 4200 m
  assert.equal(summitWind(3000, P({ w700: 33, w600: 50 })), 33) // exactly on a level
})

test('summitWind — low hills use the 10 m wind, very high peaks the top level', () => {
  assert.equal(summitWind(800, P({ wind10: 12, w850: 30 })), 12)
  assert.equal(summitWind(4806, P({ w700: 40, w600: 65 })), 65) // Mont Blanc
})

test('summitWind — the world’s highest peaks use the 500 and 300 hPa winds', () => {
  assert.equal(summitWind(7400, P({ w500: 60, w300: 120 })), 90) // halfway 5600 → 9200 m
  assert.equal(summitWind(5895, P({ w600: 40, w500: 60 })), 60) // Kilimanjaro, no 300 hPa
})

test('summitWind — missing levels fall back to the nearest one; no level at all sits the vote out', () => {
  assert.equal(summitWind(2000, P({ w700: 35 })), 35)
  assert.equal(summitWind(3500, P({ w850: 25 })), 25)
  // 10 m wind on smoothed terrain would drag the summit consensus down
  assert.equal(summitWind(3500, P({ wind10: 9 })), null)
  assert.equal(summitWind(3500, P({})), null)
})

test('freezingLevel — the model value where published, else from the summit temperature', () => {
  assert.equal(freezingLevel({ fl: 2847, temp: 0 }, 3000), 2850)
  assert.equal(freezingLevel({ fl: null, temp: 3.25 }, 3000), 3500)
  assert.equal(freezingLevel({ fl: null, temp: -6.5 }, 3000), 2000)
  assert.equal(freezingLevel({ fl: null, temp: -30 }, 1000), 0)
  assert.equal(freezingLevel({ fl: null, temp: null }, 1000), null)
})

test('stormRisk — CAPE with rain, lightning potential, or unknown', () => {
  assert.equal(stormRisk({ cape: 1200, pop: 35, lpi: null }), 'high')
  assert.equal(stormRisk({ cape: 1200, pop: 10, lpi: null }), 'low') // energy but no trigger
  assert.equal(stormRisk({ cape: 400, pop: 25, lpi: null }), 'moderate')
  assert.equal(stormRisk({ cape: 100, pop: 90, lpi: null }), 'low')
  assert.equal(stormRisk({ cape: null, pop: 50, lpi: 2 }), 'high')
  assert.equal(stormRisk({ cape: null, pop: 50, lpi: null }), null)
})
