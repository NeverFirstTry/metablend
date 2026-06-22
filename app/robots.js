export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://metablend-beta.vercel.app/sitemap.xml',
  }
}
