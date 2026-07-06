import TermsContent from './content'

export const metadata = {
  title: 'Terms & Copyright — MetaBlend',
  description: 'Terms of use, disclaimer, copyright and data attribution for MetaBlend.',
}

// Metadata must live in a server component; the localized body is client-side
// (it reads the language cookie the home page writes).
export default function Terms() {
  return <TermsContent />
}
