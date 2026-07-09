// Metadata for the client page (server layouts own SEO tags in the App Router).
export const metadata = {
  title: 'Weather API Leaderboard — Which Forecast Is Most Accurate?',
  description:
    'Which weather source is most accurate? Live per-region rankings of 16 ' +
    'providers, scored hourly against real station observations.',
  alternates: { canonical: '/leaderboard' },
}

export default function LeaderboardLayout({ children }) {
  return children
}
