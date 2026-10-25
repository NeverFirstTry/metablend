// A MeteoAlarm feed trimmed to what parseFeed reads (pure — unit tested; the
// database does the same in supabase/warnings-feeds.sql, trim_warning_feed).
// Feeds keep every expired warning (Germany ~7 MB for ~50 in force). Only an
// alert parseFeed could still show stays whole: Actual, not a Cancel, level
// 2–4 (read the way parseFeed reads it) and with any info valid after
// `cutoff`. Every other alert shrinks to the fields that update / cancel
// replacement and duplicate handling read. parseFeed gives the same result
// for any `now` ≥ cutoff.
const STUB = ['identifier', 'msgType', 'status', 'sent', 'references']

const param = (info, name) => info?.parameter?.find?.(p => p.valueName === name)?.value ?? null
function mayShow(a, cutoff) {
  if (a?.msgType === 'Cancel' || a?.status !== 'Actual') return false
  const infos = (Array.isArray(a.info) ? a.info : []).filter(Boolean)
  const main = infos.find(i => param(i, 'awareness_level')) ?? infos[0]
  const level = Number.parseInt(String(param(main, 'awareness_level') ?? ''), 10)
  return level >= 2 && level <= 4 && infos.some(i => Date.parse(i?.expires) > cutoff)
}

export function trimFeed(json, cutoff) {
  const warnings = Array.isArray(json?.warnings) ? json.warnings : []
  return {
    warnings: warnings.map(w => {
      const a = w?.alert
      if (mayShow(a, cutoff)) return w
      const stub = {}
      for (const k of STUB) if (a?.[k] != null) stub[k] = a[k]
      return { alert: stub }
    }),
  }
}
