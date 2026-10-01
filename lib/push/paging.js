// Read every row of a Supabase query in 1000-row pages (PostgREST's default
// cap), and fail closed: an error throws, so the hourly run stops and the
// next one retries — instead of an empty send log that would re-send
// everything and lift the daily cap.
export async function readAll(page, size = 1000) {
  const out = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message ?? 'database read failed')
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}
