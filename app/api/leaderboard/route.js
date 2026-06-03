import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('api_weights')
    .select('id, name, weight, score, reports, updated_at')
    .order('weight', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ apis: data })
}
