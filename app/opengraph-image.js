import { ImageResponse } from 'next/og'
import { landingCard } from './components/OgCard'

// The start page's share card (every page without its own: city, summit, airport pages ...): the language
// pages' card in English, built once in the build. Next wires it into og:image and twitter:image.
export const alt = 'MetaBlend: one forecast from up to 20 sources'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  const { element, fonts } = await landingCard('en')
  return new ImageResponse(element, { ...size, fonts })
}
