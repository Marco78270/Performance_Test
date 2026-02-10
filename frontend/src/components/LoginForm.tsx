import { useState } from 'react'
import { saveCredentials, checkAuth } from '../api/auth'

interface LoginFormProps {
  onLogin: () => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      saveCredentials(username, password)
      const ok = await checkAuth()
      if (ok) {
        onLogin()
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <form className="login-form card" onSubmit={handleSubmit}>
        <h2 className="login-title">Gatling Web</h2>
        {error && <div className="login-error">{error}</div>}
        <label className="login-label">
          Username
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label className="login-label">
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
