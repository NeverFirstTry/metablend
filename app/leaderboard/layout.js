// Metadata for the client page (server layouts own SEO tags in the App Router).
export const metadata = {
  title: 'Weather API Leaderboard — Which Forecast Is Most Accurate?',
  description:
    'Live accuracy rankings of 16 weather sources per region — ECMWF, GFS, ICON, ' +
    'Open-Meteo, MET Norway and more — scored hourly against real station ' +
    'observations and community reports.',
  alternates: { canonical: '/leaderboard' },
}

export default function LeaderboardLayout({ children }) {
  return children
}
