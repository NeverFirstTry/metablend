// Metadata for the client page (server layouts own SEO tags in the App Router).
export const metadata = {
  title: 'Forecast Accuracy Heatmap',
  description:
    'A world map of where the weather consensus was right — and where it missed — ' +
    'built from community weather reports.',
  alternates: { canonical: '/heatmap' },
}

export default function HeatmapLayout({ children }) {
  return children
}
