import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchSeleniumClasses, fetchGridStatus, launchSeleniumTest,
  fetchSeleniumTests, type SeleniumTestRun,
} from '../api/seleniumApi'

export default function SeleniumDashboardPage() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState<string[]>([])
  const [scriptClass, setScriptClass] = useState('')
  const [browser, setBrowser] = useState('chrome')
  const [instances, setInstances] = useState(1)
  const [version, setVersion] = useState('')
  const [headless, setHeadless] = useState(false)
  const [loops, setLoops] = useState(1)
  const [rampUpSeconds, setRampUpSeconds] = useState(0)
  const [gridStatus, setGridStatus] = useState<{ status: string; url: string }>({ status: 'UNKNOWN', url: '' })
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')
  const [recentTests, setRecentTests] = useState<SeleniumTestRun[]>([])

  useEffect(() => {
    fetchSeleniumClasses().then(setClasses).catch(() => {})
    fetchGridStatus().then(setGridStatus).catch(() => {})
    fetchSeleniumTests({ page: 0, size: 5 }).then(p => setRecentTests(p.content)).catch(() => {})
  }, [])

  async function handleLaunch() {
    if (!scriptClass) { setError('Please select a script class'); return }
    setLaunching(true)
    setError('')
    try {
      const run = await launchSeleniumTest({
        scriptClass,
        browser,
        instances,
        version: version || undefined,
        headless,
        loops,
        rampUpSeconds,
      })
      navigate(`/selenium/test/${run.id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLaunching(false)
    }
  }

  const statusColor = gridStatus.status === 'READY' ? '#4ade80'
    : gridStatus.status === 'STARTING' ? '#facc15' : '#f87171'

  const rampUpInfo = rampUpSeconds > 0 && instances > 1
    ? `1 nouveau browser toutes les ${(rampUpSeconds / (instances - 1)).toFixed(1)}s`
    : null

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2>Selenium Dashboard</h2>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Launch Selenium Test</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Script Class
            </label>
            <select value={scriptClass} onChange={(e) => setScriptClass(e.target.value)}
              style={{ width: '100%' }}>
              <option value="">-- Select script --</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Browser
            </label>
            <select value={browser} onChange={(e) => setBrowser(e.target.value)}
              style={{ width: '100%' }}>
              <option value="chrome">Chrome</option>
              <option value="firefox">Firefox</option>
              <option value="edge">Edge</option>
            </select>
          </div>

          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Instances (1-20)
            </label>
            <input type="number" min={1} max={20} value={instances}
              onChange={(e) => setInstances(Math.max(1, Math.min(20, Number(e.target.value))))}
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Version (optional)
            </label>
            <input type="text" placeholder="v1.0" value={version}
              onChange={(e) => setVersion(e.target.value)}
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Loops (1-100)
            </label>
            <input type="number" min={1} max={100} value={loops}
              onChange={(e) => setLoops(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ color: '#a0a0b8', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
              Ramp-up (0-600s)
            </label>
            <input type="number" min={0} max={600} value={rampUpSeconds}
              onChange={(e) => setRampUpSeconds(Math.max(0, Math.min(600, Number(e.target.value))))}
              style={{ width: '100%' }} />
            {rampUpInfo && (
              <div style={{ color: '#60a5fa', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                {rampUpInfo}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="headless" checked={headless}
            onChange={(e) => setHeadless(e.target.checked)} />
          <label htmlFor="headless" style={{ color: '#a0a0b8', fontSize: '0.85rem', cursor: 'pointer' }}>
            Mode headless (navigateur invisible)
          </label>
        </div>

        <div className="flex-row" style={{ marginTop: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: statusColor, display: 'inline-block',
            }} />
            <span style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>
              Drivers: {gridStatus.status}
            </span>
          </div>
          <button className="btn btn-primary" onClick={handleLaunch} disabled={launching || !scriptClass}>
            {launching ? 'Launching...' : 'Launch Test'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#f87171', marginTop: '0.5rem', fontSize: '0.85rem' }}>{error}</div>
        )}
      </div>

      {recentTests.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Recent Tests</h3>
          <table className="data-table" style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Script</th>
                <th>Browser</th>
                <th>Instances</th>
                <th>Loops</th>
                <th>Status</th>
                <th>Result</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentTests.map(t => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td>{t.scriptClass}</td>
                  <td>{t.browser}</td>
                  <td>{t.instances}</td>
                  <td>{t.loops ?? 1}</td>
                  <td>
                    <span className={`status-badge status-${t.status.toLowerCase()}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {t.status !== 'QUEUED' && t.status !== 'RUNNING' && (
                      <span>
                        {t.loops > 1
                          ? `${t.passedIterations}/${t.totalIterations} iter`
                          : `${t.passedInstances}/${t.totalInstances} passed`
                        }
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      onClick={() => navigate(`/selenium/test/${t.id}`)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
