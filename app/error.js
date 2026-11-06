'use client'

import ProblemScreen from './components/ProblemScreen'

// A page that breaks inside the layout: the header and theme still work.
export default function ErrorPage({ reset }) {
  return <ProblemScreen titleKey="errorPageTitle" textKey="errorPageText" onRetry={reset} />
}
