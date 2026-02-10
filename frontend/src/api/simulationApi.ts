export interface SimulationFile {
  path: string
  name: string
  directory: boolean
  children?: SimulationFile[]
}

export async function fetchFileTree(): Promise<SimulationFile[]> {
  const res = await fetch('/api/simulations/files')
  if (!res.ok) throw new Error('Failed to fetch file tree')
  return res.json()
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(`/api/simulations/files?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error('Failed to fetch file')
  const data = await res.json()
  return data.content
}

export async function saveFile(path: string, content: string): Promise<void> {
  const res = await fetch(`/api/simulations/files?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to save file')
}

export async function createFile(path: string, content = ''): Promise<void> {
  const res = await fetch('/api/simulations/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error('Failed to create file')
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch(`/api/simulations/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete file')
}

export async function fetchSimulationClasses(): Promise<string[]> {
  const res = await fetch('/api/simulations/classes')
  if (!res.ok) throw new Error('Failed to fetch classes')
  return res.json()
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const res = await fetch('/api/simulations/files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  })
  if (!res.ok) throw new Error('Failed to rename file')
}

export async function createDirectory(path: string): Promise<void> {
  const res = await fetch('/api/simulations/directories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('Failed to create directory')
}
