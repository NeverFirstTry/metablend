// The texts on a language page's share image (app/[lang]/opengraph-image.js). The bundled fonts
// hold exactly these characters; lib/landing.test.js says when scripts/brand/og-fonts.mjs must run again.
export const OG_BRAND = 'MetaBlendmetablend.app'
export const ogText = text => `${text('homeLead')}${text('landingFree')}`
