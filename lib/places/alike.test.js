// lib/places/alike.js: which look-alikes a reader can follow.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLike } from './alike.js'

test('looksLike: a later word of the name begins with the text', () => {
  assert.equal(looksLike('inn', 'wasserburg am inn'), true)
  assert.equal(looksLike('isch', 'bad ischl'), true)
  assert.equal(looksLike('gast', 'bad-gastein'), true)
  assert.equal(looksLike('inns', 'ried im innkreis'), false, '"innkreis" does not begin with "inns"')
  assert.equal(looksLike('ugs', 'augsburg'), false, 'inside a word is not the beginning of one')
})

test('looksLike: from six letters on, the name holds the text, as the summits do', () => {
  assert.equal(looksLike('glockner', 'heiligenblut am großglockner'), true)
  assert.equal(looksLike('zeiger', 'hochzeiger'), true)
  assert.equal(looksLike('eiger', 'hochzeiger'), false, 'five letters: not yet')
  assert.equal(looksLike('ugsbu', 'augsburg'), false)
})

test('looksLike: from five letters on, one slip of the finger at the beginning of the name', () => {
  assert.equal(looksLike('insbr', 'innsbruck'), true, 'a letter missing')
  assert.equal(looksLike('innbsr', 'innsbruck'), true, 'two letters swapped')
  assert.equal(looksLike('innzbr', 'innsbruck'), true, 'a letter wrong')
  assert.equal(looksLike('innnsb', 'innsbruck'), true, 'a letter too many')
  assert.equal(looksLike('salzbrug', 'salzburg'), true)
  assert.equal(looksLike('isnbr', 'innsbruck'), false, 'two slips')
  assert.equal(looksLike('ansbr', 'innsbruck'), false, 'the first letter counts as right')
  assert.equal(looksLike('insbr', 'insberg'), true, 'and a neighbour by one letter is offered too')
})

test('looksLike: four letters are too few for a slip, and a name that is simply different is never offered', () => {
  // "Inns" on production, 2026-11-14: Innsbruck, then Kreith, Augsburg, Vinzons, Innisfil
  for (const name of ['kreith', 'augsburg', 'vinzons', 'innisfil', 'innoshima', 'indre by', 'inner huai khwang', 'sydney central business district', 'muhldorf', 'quinns rocks'])
    assert.equal(looksLike('inns', name), false, name)
  assert.equal(looksLike('oslo', 'san pablo oztotepec'), false)
  assert.equal(looksLike('', 'wien'), false)
  assert.equal(looksLike('wien', ''), false)
})
