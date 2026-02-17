import { useState } from 'react'

export default function RecorderPage() {
  const [launching, setLaunching] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLaunch() {
    setLaunching(true)
    setMessage('')
    try {
      const res = await fetch('/api/recorder/launch', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Recorder launched successfully. The Gatling Recorder GUI should open shortly.')
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to launch recorder')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Gatling Recorder</h1>

      <div className="card">
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          The Gatling Recorder allows you to capture browser interactions and generate Gatling simulation scripts.
          It starts a proxy server that records HTTP requests and responses.
        </p>
        <h3>How to use:</h3>
        <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Click "Launch Recorder" to start the Gatling Recorder GUI</li>
          <li>Configure your browser to use the recorder's proxy (default: localhost:8000)</li>
          <li>Browse your target application</li>
          <li>Stop the recording to generate the simulation script</li>
          <li>The generated script will appear in the simulations directory</li>
        </ol>

        <button className="btn btn-primary" style={{ marginTop: '1rem' }}
          onClick={handleLaunch} disabled={launching}>
          {launching ? 'Launching...' : 'Launch Recorder'}
        </button>

        {message && (
          <p style={{ marginTop: '0.5rem', color: message.includes('success') ? '#27ae60' : '#e94560' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
