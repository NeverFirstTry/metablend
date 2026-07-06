import PrivacyContent from './content'

export const metadata = {
  title: 'Privacy — MetaBlend',
  description: 'What data MetaBlend collects and how it is used.',
}

// Metadata must live in a server component; the localized body is client-side
// (it reads the language cookie the home page writes).
export default function Privacy() {
  return <PrivacyContent />
}
