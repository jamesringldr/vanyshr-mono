const ALLOWED_ORIGINS = [
  'https://app.vanyshr.com',
]

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Any local Vite port — worktrees do not all land on 5173.
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true
  if (/^https:\/\/vanyshr-[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true
  return false
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ''

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
