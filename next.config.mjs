/** @type {import('next').NextConfig} */

// Defense-in-depth response headers. No X-Frame-Options / frame-ancestors here
// on purpose — the /widget route is meant to be embedded in other sites.
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
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig;
