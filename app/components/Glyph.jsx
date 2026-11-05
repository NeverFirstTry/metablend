import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'

const ICONS = {
  '☀': Sun, '🌙': Moon, '☁': Cloud, '⛅': CloudSun, '🌤': CloudSun, '🌥': CloudSun,
  '🌦': CloudDrizzle, '🌧': CloudRain, '🌨': CloudSnow, '❄': CloudSnow, '⛈': CloudLightning, '🌩': CloudLightning, '🌫': CloudFog,
}

// A weather symbol: the emoji inside the app, a drawn icon on the website.
export default function Glyph({ emoji, size = 20, fallback = null }) {
  if (!emoji) return fallback
  const Icon = ICONS[emoji.replace('️', '')]
  if (!Icon) return emoji
  return (
    <>
      <span className="app-only">{emoji}</span>
      <span className="web-only inline-flex align-[-0.125em]"><Icon size={size} aria-hidden /></span>
    </>
  )
}
