import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Moon, Sun } from 'lucide-react'

// the sun gold (the accent), the moon pale blue-grey, clouds neutral, rain and snow in the rain colour
const SUN = 'var(--accent)', MOON = 'var(--moon)', CLOUD = 'var(--neutral)', RAIN = 'var(--info)'

// partly cloudy in both colours: lucide's cloud-sun (ISC), the sun's part gold, the cloud neutral
function CloudSun({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g style={{ color: SUN }}><path d="M12 2v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="M20 12h2" /><path d="m19.07 4.93-1.41 1.41" /><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /></g>
      <path style={{ color: CLOUD }} d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
    </svg>
  )
}

const ICONS = {
  '☀': [Sun, SUN], '🌙': [Moon, MOON], '☁': [Cloud, CLOUD], '⛅': [CloudSun], '🌤': [CloudSun], '🌥': [CloudSun],
  '🌦': [CloudDrizzle, RAIN], '🌧': [CloudRain, RAIN], '🌨': [CloudSnow, RAIN], '❄': [CloudSnow, RAIN],
  '⛈': [CloudLightning, RAIN], '🌩': [CloudLightning, RAIN], '🌫': [CloudFog, CLOUD],
}

// A weather symbol, drawn and in colour, on the website and in the app.
export default function Glyph({ emoji, size = 20, fallback = null }) {
  if (!emoji) return fallback
  const Icon = ICONS[emoji.replace('️', '')]
  if (!Icon) return emoji
  const [Drawn, color] = Icon
  return <span className="inline-flex align-[-0.125em]" style={color ? { color } : undefined}><Drawn size={size} aria-hidden /></span>
}
