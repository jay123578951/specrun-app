import type { HealthResponse } from './types'

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health')
  if (!res.ok)
    throw new Error(`GET /api/health failed: ${res.status}`)
  return res.json()
}
