// Supabase access for push (server only). Thin on purpose: the decisions
// live in rules.js / validate.js, which are unit tested; this is plumbing.
import { supabase } from '../supabase.js'
import { hashDeviceKey } from './validate.js'
import { addDays } from '../localtime.js'

export const SETTINGS_COLS = 'id, home_name, alert_rain, alert_storm, alert_severe, alert_heat, briefing, briefing_hour, lang, unit'
const DEVICE_COLS = `${SETTINGS_COLS}, token, platform, apns_env`

export async function authDevice(request) {
  const hash = hashDeviceKey(request.headers.get('x-device-key'))
  if (!hash) return null
  const { data } = await supabase.from('push_devices').select(DEVICE_COLS).eq('key_hash', hash).maybeSingle()
  return data ?? null
}

// A token belongs to one phone: a reinstall (new key, same token) moves it.
export async function registerDevice(keyHash, { token, platform, lang, unit }) {
  await supabase.from('push_devices').delete().eq('token', token).neq('key_hash', keyHash)
  const { data, error } = await supabase.from('push_devices')
    .upsert({ key_hash: keyHash, token, platform, lang, unit, last_seen: new Date().toISOString() }, { onConflict: 'key_hash' })
    .select(SETTINGS_COLS).single()
  if (error) throw error
  return data
}

export async function updateSettings(id, patch) {
  const { data, error } = await supabase.from('push_devices').update(patch).eq('id', id).select(SETTINGS_COLS).single()
  if (error) throw error
  return data
}

export async function listPlans(deviceId) {
  const since = addDays(new Date().toISOString().slice(0, 10), -1)
  const { data } = await supabase.from('hike_plans').select('id, name, lat, lon, elev, date')
    .eq('device_id', deviceId).gte('date', since).order('date')
  return data ?? []
}

export async function addPlan(deviceId, plan) {
  const { count } = await supabase.from('hike_plans').select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId).gte('date', addDays(new Date().toISOString().slice(0, 10), -1))
  if ((count ?? 0) >= 10) return { error: 'At most 10 planned hikes' }
  const { data, error } = await supabase.from('hike_plans').insert({ device_id: deviceId, ...plan }).select('id, name, lat, lon, elev, date').single()
  if (error) throw error
  return { plan: data }
}

export async function deletePlan(deviceId, id) {
  await supabase.from('hike_plans').delete().eq('id', id).eq('device_id', deviceId)
}

export async function logSent(deviceId, kind, ref, now = Date.now()) {
  await supabase.from('push_log').insert({ device_id: deviceId, kind, ref, sent_at: new Date(now).toISOString() })
}

export const deleteDevice = id => supabase.from('push_devices').delete().eq('id', id)
export const setApnsEnv = (id, env) => supabase.from('push_devices').update({ apns_env: env }).eq('id', id)
export const updatePlan = (id, patch) => supabase.from('hike_plans').update(patch).eq('id', id)

export async function devicesForDispatch(extraIds = []) {
  const any = 'alert_rain.eq.true,alert_storm.eq.true,alert_severe.eq.true,alert_heat.eq.true,briefing.eq.true'
  const { data } = await supabase.from('push_devices').select(DEVICE_COLS)
    .or(extraIds.length ? `${any},id.in.(${extraIds.join(',')})` : any)
  return data ?? []
}

export async function openPlans(now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10)
  const { data } = await supabase.from('hike_plans').select('id, device_id, name, lat, lon, elev, date, sent_evening, sent_morning, last_window')
    .gte('date', addDays(today, -1)).lte('date', addDays(today, 2)).eq('sent_morning', false)
  return data ?? []
}

export async function recentLog(ids, since) {
  if (!ids.length) return []
  const { data } = await supabase.from('push_log').select('device_id, kind, ref, sent_at')
    .in('device_id', ids).gte('sent_at', new Date(since).toISOString())
  return (data ?? []).map(e => ({ ...e, sent_at: Date.parse(e.sent_at) }))
}
