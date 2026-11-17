// Crawlers asked to stay out of every page. A stored page that a crawler fetches can cost a rebuild with
// requests to the weather services, and these bring no visitors: Exa's crawler asked about 145 city pages
// a day (November 2026, roughly a fifth of all Open-Meteo calls), Ahrefs and Semrush crawl for their own
// SEO tools. Each says it obeys robots.txt (crawler.exa.ai, ahrefs.com/robot, semrush.com/bot). Search
// engines and OpenAI's search crawler (OAI-SearchBot) stay under the general rule.
const KEPT_OUT = ['ExaSearchBot', 'AhrefsBot', 'SemrushBot', 'SemrushBot-BA']

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: '/api/' },
      { userAgent: KEPT_OUT, disallow: '/' },
    ],
    sitemap: 'https://metablend.app/sitemap.xml',
  }
}
