import SupportContent from './SupportContent'

export const metadata = {
  title: 'Support',
  description: 'Contact MetaBlend, and answers to common questions: where the forecasts come from, notifications and your data.',
  alternates: { canonical: '/support' },
}

// Metadata in a server component; the localized body is client-side (it
// reads the language cookie), like /testers and /privacy. Static: no render per visit.
export default function Support() {
  return <SupportContent />
}
