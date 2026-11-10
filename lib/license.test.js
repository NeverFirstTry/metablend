// The licence (owner's decision, 2026-11-10): the code is source-available under FSL-1.1-ALv2, the
// official text unchanged but for the copyright line, and it is never called open source. What we
// ship of others' work is named with its licence text in THIRD_PARTY_NOTICES.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const json = path => JSON.parse(read(path))

test('LICENSE is the Functional Source License 1.1 with Apache 2.0 as the future licence, in the owner\'s name', () => {
  const text = read('LICENSE')
  assert.match(text, /^# Functional Source License, Version 1\.1, ALv2 Future License\n/)
  assert.match(text, /\nFSL-1\.1-ALv2\n/)
  assert.match(text, /\nCopyright 2026 Rene Kostmann\n/)
  assert.doesNotMatch(text, /\$\{/, 'no placeholder of the template is left')
  // the two clauses the choice was made for: what is not allowed, and what happens after two years
  assert.match(text, /A Competing Use\nmeans making the Software available to others in a commercial product or\nservice that:/)
  assert.match(text, /We hereby irrevocably grant you an additional license to use the Software under\nthe Apache License, Version 2\.0 that is effective on the second anniversary of\nthe date we make the Software available\./)
})

test('both package files name the licence', () => {
  assert.equal(json('package.json').license, 'FSL-1.1-ALv2')
  assert.equal(json('mobile/package.json').license, 'FSL-1.1-ALv2')
})

test('the README says source-available and Fair Source, explains the two years, and never says open source', () => {
  const readme = read('README.md')
  const section = readme.slice(readme.indexOf('\n## License\n'), readme.indexOf('\n## ', readme.indexOf('\n## License\n') + 5))
  assert.match(section, /source-available/)
  assert.match(section, /Fair Source/)
  assert.match(section, /Apache License 2\.0 two years after it was published/)
  assert.match(section, /FSL-1\.1-ALv2/)
  for (const file of ['README.md', 'CONTRIBUTING.md']) assert.doesNotMatch(read(file), /open[- ]source/i, `${file} calls nothing open source`)
  assert.doesNotMatch(readme, /All rights reserved/i)
})

test('THIRD_PARTY_NOTICES names everything the site depends on, Leaflet and the two fonts, each with a licence text', () => {
  const notices = read('THIRD_PARTY_NOTICES.md')
  for (const name of Object.keys(json('package.json').dependencies)) assert.ok(notices.includes(`| ${name} |`), `${name} is listed`)
  for (const name of ['Leaflet', 'Hanken Grotesk (font)', 'Geist Mono (font)', '@capacitor/android', '@capacitor/ios']) assert.ok(notices.includes(`| ${name} |`), `${name} is listed`)
  for (const phrase of ['BSD 2-Clause License', 'SIL OPEN FONT LICENSE Version 1.1', 'Copyright 2021 The Hanken Grotesk Project Authors', 'Copyright 2024 The Geist Project Authors', 'Apache License', 'Permission is hereby granted, free of charge']) {
    assert.ok(notices.includes(phrase), `the text "${phrase}" is in the file`)
  }
  // every row of the table has its text further down: its name stands in a heading over a text block
  const rows = [...notices.matchAll(/^\| ([^|]+) \| [^|]+ \| [^|]+ \| [^|]+ \|$/gm)].map(m => m[1].replaceAll('\\|', '|')).filter(n => n !== 'Component')
  const headings = notices.split('\n').filter(l => l.startsWith('### ')).join('\n')
  assert.ok(rows.length >= 30, `${rows.length} components`)
  for (const name of rows) assert.ok(headings.includes(name), `${name} has its licence text`)
})
