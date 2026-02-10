const USERNAME_KEY = 'gatling_username'
const PASSWORD_KEY = 'gatling_password'

export function saveCredentials(username: string, password: string): void {
  sessionStorage.setItem(USERNAME_KEY, username)
  sessionStorage.setItem(PASSWORD_KEY, password)
}

export function clearCredentials(): void {
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem(PASSWORD_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const username = sessionStorage.getItem(USERNAME_KEY)
  const password = sessionStorage.getItem(PASSWORD_KEY)
  if (username && password) {
    return { 'Authorization': 'Basic ' + btoa(username + ':' + password) }
  }
  return {}
}

export async function checkAuth(): Promise<boolean> {
  const headers = getAuthHeaders()
  if (!headers['Authorization']) return false
  try {
    const res = await fetch('/api/auth/check', { headers })
    return res.ok
  } catch {
    return false
  }
}
