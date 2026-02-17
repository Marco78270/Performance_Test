import { useState, useEffect } from 'react'
import { fetchDriverConfig, saveDriverConfig } from '../api/seleniumApi'

export default function SeleniumConfigPage() {
  const [chrome, setChrome] = useState('')
  const [firefox, setFirefox] = useState('')
  const [edge, setEdge] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDriverConfig()
      .then(cfg => {
        setChrome(cfg.chrome)
        setFirefox(cfg.firefox)
        setEdge(cfg.edge)
      })
      .catch(() => setError('Failed to load driver configuration'))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await saveDriverConfig({ chrome, firefox, edge })
      setMessage('Configuration saved successfully')
    } catch {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    display: 'block',
    marginBottom: '0.3rem',
  }

  const hintStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    marginTop: '0.2rem',
  }

  return (
    <div style={{ maxWidth: '700px' }}>
      <h2>Selenium Configuration</h2>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>WebDriver Paths</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Configure local paths to WebDriver executables. Leave empty to auto-download via WebDriverManager.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Chrome Driver Path</label>
            <input
              type="text"
              value={chrome}
              onChange={e => setChrome(e.target.value)}
              placeholder="C:\path\to\chromedriver.exe"
              style={{ width: '100%' }}
            />
            <div style={hintStyle}>chromedriver.exe - must match your Chrome browser version</div>
          </div>

          <div>
            <label style={labelStyle}>Firefox Driver Path (GeckoDriver)</label>
            <input
              type="text"
              value={firefox}
              onChange={e => setFirefox(e.target.value)}
              placeholder="C:\path\to\geckodriver.exe"
              style={{ width: '100%' }}
            />
            <div style={hintStyle}>geckodriver.exe - for Firefox browser</div>
          </div>

          <div>
            <label style={labelStyle}>Edge Driver Path</label>
            <input
              type="text"
              value={edge}
              onChange={e => setEdge(e.target.value)}
              placeholder="C:\path\to\msedgedriver.exe"
              style={{ width: '100%' }}
            />
            <div style={hintStyle}>msedgedriver.exe - must match your Edge browser version</div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {message && <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>{message}</span>}
          {error && <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}
