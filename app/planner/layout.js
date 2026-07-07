// Metadata for the client page (server layouts own SEO tags in the App Router).
export const metadata = {
  title: 'Travel Weather Planner — Best Months to Visit Any City',
  description:
    'Find the best time to visit any city: average temperature and rainy days ' +
    'for all 12 months, from 10 years of climate data.',
  alternates: { canonical: '/planner' },
}

export default function PlannerLayout({ children }) {
  return children
}
