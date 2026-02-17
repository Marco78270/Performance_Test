import { authFetch } from './authFetch'

export interface ThresholdRule {
  metric: string
  operator: 'LT' | 'GT' | 'LTE' | 'GTE'
  value: number
  label: string
}

export interface ThresholdProfile {
  id: number
  name: string
  simulationClass: string
  rules: ThresholdRule[]
  createdAt: string
  updatedAt: string
}

export interface ThresholdEvaluationResult {
  metric: string
  operator: string
  threshold: number
  actual: number
  passed: boolean
}

export interface CreateThresholdProfileRequest {
  name: string
  simulationClass: string
  rules: ThresholdRule[]
}

export async function fetchThresholdProfiles(): Promise<ThresholdProfile[]> {
  const res = await authFetch('/api/thresholds')
  if (!res.ok) throw new Error('Failed to fetch threshold profiles')
  return res.json()
}

export async function createThresholdProfile(request: CreateThresholdProfileRequest): Promise<ThresholdProfile> {
  const res = await authFetch('/api/thresholds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create profile')
  }
  return res.json()
}

export async function updateThresholdProfile(id: number, request: CreateThresholdProfileRequest): Promise<ThresholdProfile> {
  const res = await authFetch(`/api/thresholds/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update profile')
  }
  return res.json()
}

export async function deleteThresholdProfile(id: number): Promise<void> {
  const res = await authFetch(`/api/thresholds/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete profile')
}
