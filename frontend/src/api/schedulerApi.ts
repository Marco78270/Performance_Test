import { authFetch } from './authFetch'

export interface ScheduledJob {
  id: number
  testType: string
  scriptClass: string
  launchParamsJson: string | null
  scheduledAt: number
  status: 'PENDING' | 'LAUNCHED' | 'CANCELLED' | 'FAILED'
  launchedAt: number | null
  createdAt: number
  notes: string | null
}

export async function fetchScheduledJobs(): Promise<ScheduledJob[]> {
  const res = await authFetch('/api/scheduler')
  if (!res.ok) throw new Error('Failed to fetch scheduled jobs')
  return res.json()
}

export async function createScheduledJob(job: Omit<ScheduledJob, 'id' | 'createdAt' | 'launchedAt'>): Promise<ScheduledJob> {
  const res = await authFetch('/api/scheduler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  })
  if (!res.ok) throw new Error('Failed to create scheduled job')
  return res.json()
}

export async function cancelScheduledJob(id: number): Promise<void> {
  const res = await authFetch(`/api/scheduler/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to cancel scheduled job')
}
