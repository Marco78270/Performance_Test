import { authFetch } from './authFetch'
import { type TestRun } from './testRunApi'

export interface ComparisonResult {
  testA: TestRun
  testB: TestRun
  diffPercent: Record<string, number | null>
}

export async function fetchComparison(idA: number, idB: number): Promise<ComparisonResult> {
  const res = await authFetch(`/api/tests/compare?ids=${idA},${idB}`)
  if (!res.ok) throw new Error('Failed to fetch comparison')
  return res.json()
}
