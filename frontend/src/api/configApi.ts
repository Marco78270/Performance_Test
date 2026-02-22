import { authFetch } from './authFetch'

export interface ConfigExport {
  version: string
  exportedAt: string
  thresholdProfiles: { name: string; simulationClass: string; rules: string }[]
  monitoredServers: { name: string; url: string; serverType: string; enabled: boolean }[]
  appSettings: { key: string; value: string }[]
}

export async function exportConfig(): Promise<ConfigExport> {
  const res = await authFetch('/api/config/export')
  if (!res.ok) throw new Error('Failed to export config')
  return res.json()
}

export async function importConfig(config: ConfigExport): Promise<{ profiles: number; servers: number; settings: number }> {
  const res = await authFetch('/api/config/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Failed to import config')
  return res.json()
}
