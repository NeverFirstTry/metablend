import Widget from './Widget'

// The embeddable card: the same page for every visitor (the weather loads in
// the browser), so it is built once per city and then served from the CDN —
// an embed on a busy site costs no server render per view.
export const revalidate = false
export async function generateStaticParams() { return [] }

export default function Page() {
  return <Widget />
}
