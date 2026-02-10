import { authFetch } from './authFetch'

export interface ThresholdEvaluationResult {
  metric: string
  operator: string
  threshold: number
  actual: number
  passed: boolean
}

export interface TestRun {
  id: number
  simulationClass: string
  version: string | null
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  startTime: string
  endTime: string | null
  reportPath: string | null
  totalRequests: number | null
  totalErrors: number | null
  meanResponseTime: number | null
  p50ResponseTime: number | null
  p75ResponseTime: number | null
  p95ResponseTime: number | null
  p99ResponseTime: number | null
  labels: string[]
  thresholdVerdict: 'PASSED' | 'FAILED' | null
  thresholdProfileId: number | null
  thresholdDetails: ThresholdEvaluationResult[] | null
  bandwidthLimitMbps: number | null
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface LaunchParams {
  simulationClass: string
  version?: string
  users?: number
  rampUp?: boolean
  rampUpDuration?: number
  duration?: number
  loop?: boolean
  bandwidthLimitMbps?: number
}

export async function launchTest(params: LaunchParams): Promise<TestRun> {
  const res = await authFetch('/api/tests/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to launch test')
  }
  return res.json()
}

export async function cancelTest(id: number): Promise<void> {
  const res = await authFetch(`/api/tests/${id}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to cancel test')
}

export interface FetchTestRunsParams {
  page?: number
  size?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  label?: string
}

export async function fetchTestRuns(params: FetchTestRunsParams = {}): Promise<Page<TestRun>> {
  const { page = 0, size = 20, sortBy = 'startTime', sortDir = 'desc', label } = params
  const query = new URLSearchParams({ page: String(page), size: String(size), sortBy, sortDir })
  if (label) query.set('label', label)
  const res = await authFetch(`/api/tests?${query}`)
  if (!res.ok) throw new Error('Failed to fetch test runs')
  return res.json()
}

export async function fetchTestRun(id: number): Promise<TestRun> {
  const res = await authFetch(`/api/tests/${id}`)
  if (!res.ok) throw new Error('Failed to fetch test run')
  return res.json()
}

export async function updateTestVersion(id: number, version: string): Promise<void> {
  const res = await authFetch(`/api/tests/${id}/version`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  if (!res.ok) throw new Error('Failed to update version')
}

export async function deleteTestRun(id: number): Promise<void> {
  const res = await authFetch(`/api/tests/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete test run')
}

export async function fetchRunningTest(): Promise<TestRun | null> {
  const res = await authFetch('/api/tests/running')
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch running test')
  return res.json()
}

export async function updateTestLabels(id: number, labels: string[]): Promise<void> {
  const res = await authFetch(`/api/tests/${id}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  })
  if (!res.ok) throw new Error('Failed to update labels')
}

export interface MetricsSnapshot {
  timestamp: number
  requestsPerSecond: number
  errorsPerSecond: number
  meanResponseTime: number
  p50: number
  p75: number
  p95: number
  p99: number
  activeUsers: number
  totalRequests: number
  totalErrors: number
}

export async function fetchTestMetrics(id: number): Promise<MetricsSnapshot[]> {
  const res = await authFetch(`/api/tests/${id}/metrics`)
  if (!res.ok) throw new Error('Failed to fetch metrics')
  return res.json()
}

export interface InfraMetricsSnapshot {
  timestamp: number
  serverId: number
  serverName: string
  serverType: string
  cpuPercent: number | null
  memoryUsedBytes: number | null
  memoryTotalBytes: number | null
  memoryPercent: number | null
  diskReadBytesPerSec: number | null
  diskWriteBytesPerSec: number | null
  networkRecvBytesPerSec: number | null
  networkSentBytesPerSec: number | null
  sqlBatchPerSec: number | null
  error: string | null
}

export async function fetchInfraMetrics(id: number): Promise<InfraMetricsSnapshot[]> {
  const res = await authFetch(`/api/tests/${id}/infra-metrics`)
  if (!res.ok) throw new Error('Failed to fetch infra metrics')
  return res.json()
}

export async function fetchQueue(): Promise<TestRun[]> {
  const res = await authFetch('/api/tests/queue')
  if (!res.ok) throw new Error('Failed to fetch queue')
  return res.json()
}

export async function cancelQueuedTest(id: number): Promise<void> {
  const res = await authFetch(`/api/tests/${id}/cancel-queued`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to cancel queued test')
}

export interface TrendPoint {
  testRunId: number
  startTime: string | null
  version: string | null
  totalRequests: number | null
  totalErrors: number | null
  meanResponseTime: number | null
  p95ResponseTime: number | null
  errorRate: number
  thresholdVerdict: string | null
}

export interface TrendData {
  simulationClass: string
  points: TrendPoint[]
  thresholdPassRate: number
}

export async function fetchTrends(simulationClass: string, limit = 20): Promise<TrendData> {
  const res = await authFetch(`/api/tests/trends?simulationClass=${encodeURIComponent(simulationClass)}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch trends')
  return res.json()
}

export async function fetchCompletedSimulationClasses(): Promise<string[]> {
  const res = await authFetch('/api/tests/simulation-classes')
  if (!res.ok) throw new Error('Failed to fetch simulation classes')
  return res.json()
}

export interface DashboardSummary {
  tests24h: number
  successRate24h: number
  avgResponseTime24h: number | null
  totalTests: number
}

export async function fetchSummary(): Promise<DashboardSummary> {
  const res = await authFetch('/api/tests/summary')
  if (!res.ok) throw new Error('Failed to fetch summary')
  return res.json()
}

export async function fetchAllLabels(): Promise<string[]> {
  const res = await authFetch('/api/tests/labels')
  if (!res.ok) throw new Error('Failed to fetch labels')
  return res.json()
}

export async function exportCsv(): Promise<void> {
  const res = await authFetch('/api/tests/export/csv')
  if (!res.ok) throw new Error('Failed to export CSV')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test-results.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportJson(): Promise<void> {
  const res = await authFetch('/api/tests/export/json')
  if (!res.ok) throw new Error('Failed to export JSON')
  const data = await res.json()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test-results.json'
  a.click()
  URL.revokeObjectURL(url)
}
