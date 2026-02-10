import { authFetch } from './authFetch'

export interface SimulationTemplate {
  id: string
  name: string
  description: string
}

export async function fetchTemplates(): Promise<SimulationTemplate[]> {
  const res = await authFetch('/api/templates')
  if (!res.ok) throw new Error('Failed to fetch templates')
  return res.json()
}

export async function fetchTemplateContent(
  id: string,
  className: string,
  packageName: string,
  baseUrl: string,
): Promise<string> {
  const params = new URLSearchParams({ className, packageName, baseUrl })
  const res = await authFetch(`/api/templates/${id}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch template content')
  const data = await res.json()
  return data.content
}
