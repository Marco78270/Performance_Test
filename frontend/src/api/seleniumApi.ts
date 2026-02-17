import { authFetch } from './authFetch'
import type { SimulationFile } from './simulationApi'

export interface SeleniumTestRun {
  id: number
  scriptClass: string
  browser: string
  instances: number
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  startTime: number | null
  endTime: number | null
  totalInstances: number
  passedInstances: number
  failedInstances: number
  loops: number
  rampUpSeconds: number
  totalIterations: number
  passedIterations: number
  failedIterations: number
  version: string | null
  labels: string
  gridUrl: string | null
  meanStepDuration: number | null
  notes: string | null
  headless: boolean
}

export interface StepResult {
  name: string
  durationMs: number
  passed: boolean
  error: string | null
}

export interface SeleniumBrowserResult {
  id: number
  testRunId: number
  browserIndex: number
  iteration: number
  status: string
  startTime: number | null
  endTime: number | null
  durationMs: number | null
  errorMessage: string | null
  stepsJson: string | null
  screenshotPath: string | null
}

export interface SeleniumLaunchParams {
  scriptClass: string
  browser: string
  instances: number
  version?: string
  headless?: boolean
  loops?: number
  rampUpSeconds?: number
}

export interface SeleniumPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface SeleniumTemplate {
  id: string
  name: string
  description: string
}

export interface SeleniumMetricsSnapshot {
  timestamp: number
  iterationsPerSecond: number
  errorsPerSecond: number
  meanStepDuration: number
  p50: number
  p75: number
  p95: number
  p99: number
  activeBrowsers: number
  totalIterations: number
  totalErrors: number
  cpuPercent: number | null
  memoryPercent: number | null
}

// --- File management ---

export async function fetchSeleniumFileTree(): Promise<SimulationFile[]> {
  const res = await authFetch('/api/selenium/files')
  if (!res.ok) throw new Error('Failed to fetch file tree')
  return res.json()
}

export async function fetchSeleniumFileContent(path: string): Promise<string> {
  const res = await authFetch(`/api/selenium/files?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error('Failed to fetch file')
  const data = await res.json()
  return data.content
}

export async function saveSeleniumFile(path: string, content: string): Promise<void> {
  const res = await authFetch(`/api/selenium/files?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to save file')
}

export async function createSeleniumFile(path: string, content = ''): Promise<void> {
  const res = await authFetch('/api/selenium/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error('Failed to create file')
}

export async function deleteSeleniumFile(path: string): Promise<void> {
  const res = await authFetch(`/api/selenium/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete file')
}

export async function renameSeleniumFile(oldPath: string, newPath: string): Promise<void> {
  const res = await authFetch('/api/selenium/files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  })
  if (!res.ok) throw new Error('Failed to rename file')
}

export async function createSeleniumDirectory(path: string): Promise<void> {
  const res = await authFetch('/api/selenium/directories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('Failed to create directory')
}

// --- Classes ---

export async function fetchSeleniumClasses(): Promise<string[]> {
  const res = await authFetch('/api/selenium/classes')
  if (!res.ok) throw new Error('Failed to fetch classes')
  return res.json()
}

// --- Templates ---

export async function fetchSeleniumTemplates(): Promise<SeleniumTemplate[]> {
  const res = await authFetch('/api/selenium/templates')
  if (!res.ok) throw new Error('Failed to fetch templates')
  return res.json()
}

export async function fetchSeleniumTemplateContent(
  id: string, className: string, baseUrl: string
): Promise<string> {
  const params = new URLSearchParams({ id, className, baseUrl })
  const res = await authFetch(`/api/selenium/templates/content?${params}`)
  if (!res.ok) throw new Error('Failed to fetch template content')
  const data = await res.json()
  return data.content
}

// --- Compilation ---

export async function compileSeleniumScripts(): Promise<{ success: boolean; output: string[] }> {
  const res = await authFetch('/api/selenium/compile', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to compile')
  return res.json()
}

// --- Test execution ---

export async function launchSeleniumTest(params: SeleniumLaunchParams): Promise<SeleniumTestRun> {
  const res = await authFetch('/api/selenium/launch', {
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

export async function fetchSeleniumTests(params: {
  page?: number; size?: number; sortBy?: string; sortDir?: string;
  browser?: string; status?: string; label?: string
} = {}): Promise<SeleniumPage<SeleniumTestRun>> {
  const p = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
    sortBy: params.sortBy ?? 'id',
    sortDir: params.sortDir ?? 'desc',
  })
  if (params.browser) p.set('browser', params.browser)
  if (params.status) p.set('status', params.status)
  if (params.label) p.set('label', params.label)
  const res = await authFetch(`/api/selenium/tests?${p}`)
  if (!res.ok) throw new Error('Failed to fetch tests')
  return res.json()
}

export async function fetchSeleniumTest(id: number): Promise<SeleniumTestRun> {
  const res = await authFetch(`/api/selenium/tests/${id}`)
  if (!res.ok) throw new Error('Failed to fetch test')
  return res.json()
}

export async function fetchSeleniumResults(id: number): Promise<SeleniumBrowserResult[]> {
  const res = await authFetch(`/api/selenium/tests/${id}/results`)
  if (!res.ok) throw new Error('Failed to fetch results')
  return res.json()
}

export async function fetchSeleniumMetrics(id: number): Promise<SeleniumMetricsSnapshot[]> {
  const res = await authFetch(`/api/selenium/tests/${id}/metrics`)
  if (!res.ok) throw new Error('Failed to fetch metrics')
  return res.json()
}

export async function deleteSeleniumTest(id: number): Promise<void> {
  const res = await authFetch(`/api/selenium/tests/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete test')
}

export async function cancelSeleniumTest(id: number): Promise<void> {
  const res = await authFetch(`/api/selenium/tests/${id}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to cancel test')
}

// --- Version & Labels ---

export async function updateSeleniumTestVersion(id: number, version: string): Promise<void> {
  const res = await authFetch(`/api/selenium/tests/${id}/version`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  if (!res.ok) throw new Error('Failed to update version')
}

export async function updateSeleniumTestNotes(id: number, notes: string): Promise<void> {
  const res = await authFetch(`/api/selenium/tests/${id}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new Error('Failed to update notes')
}

export async function updateSeleniumTestLabels(id: number, labels: string[]): Promise<void> {
  const res = await authFetch(`/api/selenium/tests/${id}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  })
  if (!res.ok) throw new Error('Failed to update labels')
}

export async function fetchSeleniumAllLabels(): Promise<string[]> {
  const res = await authFetch('/api/selenium/labels')
  if (!res.ok) throw new Error('Failed to fetch labels')
  return res.json()
}

// --- Infra metrics ---

export async function fetchSeleniumInfraMetrics(id: number): Promise<unknown[]> {
  const res = await authFetch(`/api/selenium/tests/${id}/infra-metrics`)
  if (!res.ok) throw new Error('Failed to fetch infra metrics')
  return res.json()
}

// --- Grid ---

export async function fetchGridStatus(): Promise<{ status: string; url: string }> {
  const res = await authFetch('/api/selenium/grid/status')
  if (!res.ok) throw new Error('Failed to fetch grid status')
  return res.json()
}

// --- Driver config ---

export interface DriverConfig {
  chrome: string
  firefox: string
  edge: string
}

export async function fetchDriverConfig(): Promise<DriverConfig> {
  const res = await authFetch('/api/selenium/config/drivers')
  if (!res.ok) throw new Error('Failed to fetch driver config')
  return res.json()
}

export async function saveDriverConfig(config: DriverConfig): Promise<void> {
  const res = await authFetch('/api/selenium/config/drivers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Failed to save driver config')
}
