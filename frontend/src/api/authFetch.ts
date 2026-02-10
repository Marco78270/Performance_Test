import { getAuthHeaders, clearCredentials } from './auth'

export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const authHeaders = getAuthHeaders()
  const mergedHeaders = {
    ...authHeaders,
    ...options?.headers,
  }
  const res = await fetch(url, { ...options, headers: mergedHeaders })
  if (res.status === 401) {
    clearCredentials()
    window.dispatchEvent(new Event('auth-expired'))
  }
  return res
}
