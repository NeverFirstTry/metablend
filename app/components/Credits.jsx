import Link from 'next/link'
import { t } from '@/lib/i18n'
import { DATA_CREDITS, RADAR_CREDIT, MAP_CREDIT_URL } from '@/lib/credits'

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-emerald-400">{children}</a>
)

// The data credits as one line, each in the provider's own words and linked.
// `full` adds the radar and map credits and the safety note (footer, More screen).
export default function Credits({ lang, full = false }) {
  const items = DATA_CREDITS.map(([text, href]) => <Ext key={href} href={href}>{text}</Ext>)
  // The licences and the note that blended data are changed stand on /terms (CC BY 4.0 asks for both):
  // wherever the credits are shown, they lead there.
  items.push(<Link key="licences" href="/terms#sources" className="underline decoration-dotted underline-offset-2 hover:text-emerald-400">{t(lang, 'creditLicences')}</Link>)
  if (full) {
    items.push(
      <span key="radar">{t(lang, 'creditRadar')}: <Ext href={RADAR_CREDIT[1]}>{RADAR_CREDIT[0]}</Ext></span>,
      <Ext key="maps" href={MAP_CREDIT_URL}>{t(lang, 'creditMaps')}</Ext>,
      <span key="note">{t(lang, 'footerData')}</span>,
    )
  }
  return <>{items.flatMap((item, i) => (i ? [' · ', item] : [item]))}</>
}
