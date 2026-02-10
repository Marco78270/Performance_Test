export type ServerType = 'API' | 'SQL' | 'WEB' | 'FILE'

export interface MonitoredServer {
  id: number
  name: string
  url: string
  serverType: ServerType
  enabled: boolean
  lastSeenAt: string | null
  lastError: string | null
}

export interface CreateServerRequest {
  name: string
  url: string
  serverType: ServerType
}

export async function fetchServers(): Promise<MonitoredServer[]> {
  const res = await fetch('/api/servers')
  if (!res.ok) throw new Error('Failed to fetch servers')
  return res.json()
}

export async function fetchServer(id: number): Promise<MonitoredServer> {
  const res = await fetch(`/api/servers/${id}`)
  if (!res.ok) throw new Error('Failed to fetch server')
  return res.json()
}

export async function createServer(request: CreateServerRequest): Promise<MonitoredServer> {
  const res = await fetch('/api/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create server')
  }
  return res.json()
}

export async function updateServer(id: number, request: CreateServerRequest): Promise<MonitoredServer> {
  const res = await fetch(`/api/servers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update server')
  }
  return res.json()
}

export async function toggleServer(id: number): Promise<MonitoredServer> {
  const res = await fetch(`/api/servers/${id}/toggle`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to toggle server')
  return res.json()
}

export async function deleteServer(id: number): Promise<void> {
  const res = await fetch(`/api/servers/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete server')
}
