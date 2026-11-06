import featured from '@/lib/hike/featured.json'
import { byRegion } from '@/lib/hike/featured-list'
import MountainList from './MountainList'

const peaks = featured.filter(p => p.kind !== 'hut')
const groups = byRegion(peaks).map(g => ({ region: g.region, peaks: g.peaks.map(({ id, name, elev }) => ({ id, name, elev })) }))

// Crawlable hub for the summit weather pages: every featured peak by region.
export const metadata = {
  title: `Mountain Weather — Summit Forecasts for ${peaks.length} Peaks`,
  description:
    `Summit weather for ${peaks.length} mountains worldwide: the favourable summit window, wind up top, freezing level ` +
    'and thunderstorm risk for 7 days, blended from up to 9 weather models.',
  alternates: { canonical: '/mountains' },
}

export default function MountainIndex() {
  return <MountainList groups={groups} total={peaks.length} />
}
