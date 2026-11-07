import HomePage from './HomePage'
import { landingAlternates, exampleForecast } from '@/lib/landing'
import featured from '@/lib/hike/featured.json'

// Static, so no visit runs any code here. The landing page's example refreshes at most
// hourly; a returning visitor's forecast loads in the browser, as it always has.
export const revalidate = 3600
export const metadata = { alternates: landingAlternates('en') }

export default async function Page() {
  return <HomePage example={await exampleForecast()} peaks={featured.filter(p => p.kind !== 'hut').length} />
}
