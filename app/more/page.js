import MoreClient from './MoreClient'

// The app's "More" tab — also reachable on the web, but not indexed.
export const metadata = { title: 'More', robots: { index: false } } // the layout appends " · MetaBlend"

export default function MorePage() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto"><MoreClient /></div>
    </main>
  )
}
