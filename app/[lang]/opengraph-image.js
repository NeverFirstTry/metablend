import { ImageResponse } from 'next/og'
import { LANDING_LANGS } from '@/lib/landing'
import { landingCard } from '../components/OgCard'

// The share image of /de, /fr ...: built once per language in the build, never per visit.
export const alt = 'MetaBlend'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamicParams = false
export function generateStaticParams() { return LANDING_LANGS.map(lang => ({ lang })) }

export default async function OpengraphImage({ params }) {
  const { element, fonts } = await landingCard((await params).lang)
  return new ImageResponse(element, { ...size, fonts })
}
