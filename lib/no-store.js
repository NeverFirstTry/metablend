// An API answer the CDN must not keep.
export const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
