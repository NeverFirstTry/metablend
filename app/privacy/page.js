import PrivacyContent from './content'

export const metadata = {
  title: 'Privacy Notice',
  description: 'What data MetaBlend collects, how long it is kept, and which weather providers receive your searches.',
  alternates: { canonical: '/privacy' },
}

// Metadata must live in a server component; the localized body is client-side
// (it reads the language cookie the home page writes).
export default function Privacy() {
  return <PrivacyContent />
}
