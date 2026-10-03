import TestersContent from './TestersContent'

export const metadata = {
  title: 'Test the MetaBlend app',
  description: 'Join the MetaBlend beta on Android or iPhone: weather from 16 sources, summit forecasts and hiking routes.',
  alternates: { canonical: '/testers' },
}

// Metadata in a server component; the localized body is client-side (it
// reads the language cookie), like /privacy.
export default function Testers() {
  return <TestersContent />
}
