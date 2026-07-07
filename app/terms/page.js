import TermsContent from './content'

export const metadata = {
  title: 'Terms & Copyright',
  description: 'Terms of use, disclaimer, copyright and weather data attribution for MetaBlend.',
  alternates: { canonical: '/terms' },
}

// Metadata must live in a server component; the localized body is client-side
// (it reads the language cookie the home page writes).
export default function Terms() {
  return <TermsContent />
}
