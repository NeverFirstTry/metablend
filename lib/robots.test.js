// Which crawlers may fetch the site (app/robots.js). A stored page that a crawler fetches can cost a
// rebuild with requests to the weather services, so crawlers that bring no visitors are asked to stay
// out; search engines and OpenAI's search crawler are not.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import robots from '../app/robots.js'

const groups = () => [robots().rules].flat()
const groupFor = agent => groups().find(g => [g.userAgent].flat().includes(agent))

test('everyone else: the whole site but the API, as before, and the sitemap', () => {
  assert.deepEqual(groupFor('*'), { userAgent: '*', allow: '/', disallow: '/api/' })
  assert.equal(robots().sitemap, 'https://metablend.app/sitemap.xml')
})

test('Exa\'s crawler and the SEO tools\' crawlers are asked to stay out of every page', () => {
  for (const agent of ['ExaSearchBot', 'AhrefsBot', 'SemrushBot', 'SemrushBot-BA']) assert.equal(groupFor(agent)?.disallow, '/', agent)
})

test('search engines and OpenAI\'s search crawler have no group of their own: the general one applies', () => {
  for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'Googlebot', 'bingbot', 'YandexBot', 'Applebot']) assert.equal(groupFor(agent), undefined, agent)
})
