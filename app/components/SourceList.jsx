import { t } from '@/lib/i18n'
import { tempFormatter } from '@/lib/outlook/text'
import { sourceDeviation } from '@/lib/spread'

// Every source as one row on the website: its reading, how far it sits from
// the blend, and how much it counts. Text stays neutral; gold is for the weight
// bars, and the status colour marks only a source that is clearly off or down.
// The bars are drawn against the largest weight. (The app keeps its cards.)
export default function SourceList({ data, unit, lang }) {
  const deg = c => tempFormatter(unit)(c).replace('-', '−')
  const weightOf = src => data.weights[src.apiId] ?? 0.25
  // house model first: the API appends it last
  const rows = [...data.sources].sort((a, b) => (b.apiId === 'metablend') - (a.apiId === 'metablend'))
  const most = Math.max(...rows.filter(s => !s.down).map(weightOf))
  return (
    <div className="source-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-400 text-left align-bottom">
            <th scope="col" className="font-normal pb-2 pr-2 sm:pr-3">{t(lang, 'sourceCol')}</th>
            <th scope="col" className="font-normal pb-2 px-1.5 sm:px-2 text-right">{t(lang, 'nowWord')}</th>
            <th scope="col" className="font-normal pb-2 px-1.5 sm:px-2 text-right">{t(lang, 'sourceColDiff')}</th>
            <th scope="col" className="font-normal pb-2 pl-2 sm:pl-3">{t(lang, 'weightLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(src => {
            const name = src.displayName ?? src.apiId
            if (src.down) {
              return (
                <tr key={src.apiId}>
                  <th scope="row" className="font-normal text-left py-2.5 pr-2 sm:pr-3">{name}</th>
                  <td colSpan={3} className="py-2.5 px-2" style={{ color: 'var(--bad)' }}>{t(lang, 'noResponse')}</td>
                </tr>
              )
            }
            const off = sourceDeviation(src.temp, data.consensus.temp, unit)
            const weight = weightOf(src)
            return (
              <tr key={src.apiId}>
                <th scope="row" className={`text-left py-2.5 pr-2 sm:pr-3 ${src.apiId === 'metablend' ? 'font-semibold' : 'font-normal'}`}>{name}</th>
                <td className="py-2.5 px-1.5 sm:px-2 text-right font-semibold tabular-nums whitespace-nowrap">{deg(src.temp)}</td>
                <td className={`py-2.5 px-1.5 sm:px-2 text-right tabular-nums whitespace-nowrap ${off.outlier ? '' : 'text-zinc-400'}`} style={off.outlier ? { color: 'var(--bad)' } : undefined}>{off.text}</td>
                <td className="py-2.5 pl-2 sm:pl-3">
                  <div className="flex items-center gap-2">
                    <div className="source-bar flex-1 h-1 rounded-full" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${(weight / most) * 100}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="text-xs text-zinc-400 tabular-nums w-[2.5em] text-right">{(weight * 100).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
