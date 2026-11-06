import ProblemScreen from './components/ProblemScreen'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return <ProblemScreen titleKey="notFoundTitle" textKey="notFoundText" />
}
