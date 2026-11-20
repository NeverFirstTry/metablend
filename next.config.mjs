/** @type {import('next').NextConfig} */

// Defense-in-depth response headers for every route. Framing rules are
// separate below: /widget is meant to be embedded in other sites.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
]

// The Content Security Policy, enforced (owner, 2026-11-16; report-only from 2026-11-08): the browser
// refuses whatever a page asks from a host that is not listed here. Inline scripts stay allowed (the boot
// scripts, Next's own), so this limits where a page loads from and sends to; it does not stop an injected
// inline script. A page that needs a new host needs it here first: scripts/check-phone-layout.mjs fails on
// anything refused, and mobile/README.md has the walk through the app after a change.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://plausible.io https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.opentopomap.org https://tile.opentopomap.org https://tilecache.rainviewer.com https://*.rainviewer.com",
  "connect-src 'self' https://api.rainviewer.com https://plausible.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig = {
  experimental: {
    // Vercel restores Turbopack's on-disk build cache between deploys; on
    // 2026-10-03 that shipped a stale globals.css (new utility classes, old
    // theme colours). Fresh CSS on every deploy is worth the extra build time.
    turbopackFileSystemCacheForBuild: false,
    // a page visited in the app is reused for 3 minutes when you come back (tab
    // switches); the tab bar prefetches Hiking and More in full (5 minutes)
    staleTimes: { dynamic: 180 },
  },
  async headers() {
    return [
      // every path, /widget included; the framing rule further down replaces this value on every other path
      // (where two rules set one header, Next keeps the later one)
      { source: '/:path*', headers: [...securityHeaders, { key: 'Content-Security-Policy', value: contentSecurityPolicy }] },
      // the email signature's logo: mail clients fetch it on every open, so a year in caches
      { source: '/email/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      // nobody else may frame MetaBlend's pages (clickjacking; inside the app
      // a framed page would sit next to the native bridge) — except /widget,
      // which exists to be embedded
      {
        source: '/((?!widget/).*)',
        headers: [
          { key: 'Content-Security-Policy', value: `${contentSecurityPolicy}; frame-ancestors 'none'` },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig;
