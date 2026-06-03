import { supabase } from '@/lib/supabase'

export async function GET() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [{ error: fe }, { error: fb }] = await Promise.all([
    supabase.from('forecasts').delete().lt('created_at', cutoff),
    supabase.from('feedback').delete().lt('created_at', cutoff),
  ])

  if (fe || fb) {
    return Response.json({ error: fe?.message ?? fb?.message }, { status: 500 })
  }

  return Response.json({ ok: true, cutoff })
}
