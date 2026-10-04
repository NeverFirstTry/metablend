/** @type {import('next').NextConfig} */

// Defense-in-depth response headers for every route. Framing rules are
// separate below: /widget is meant to be embedded in other sites.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
]

const nextConfig = {
  experimental: {
    // Vercel restores Turbopack's on-disk build cache between deploys; on
    // 2026-10-03 that shipped a stale globals.css (new utility classes, old
    // theme colours). Fresh CSS on every deploy is worth the extra build time.
    turbopackFileSystemCacheForBuild: false,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // nobody else may frame MetaBlend's pages (clickjacking; inside the app
      // a framed page would sit next to the native bridge) — except /widget,
      // which exists to be embedded
      {
        source: '/((?!widget/).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig;
