import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchSimulationClasses } from '../api/simulationApi'
import { launchTest, fetchRunningTest, fetchQueue, cancelQueuedTest, fetchSummary, type TestRun, type DashboardSummary } from '../api/testRunApi'
import { useQueueWebSocket } from '../hooks/useWebSocket'
import {
  fetchSeleniumClasses, fetchGridStatus, launchSeleniumTest,
  fetchSeleniumTests, type SeleniumTestRun,
} from '../api/seleniumApi'

type Tab = 'gatling' | 'selenium'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('gatling')
  const [searchParams] = useSearchParams()

  // --- Gatling state ---
  const [classes, setClasses] = useState<string[]>([])
  const [selected, setSelected] = useState(searchParams.get('simulationClass') || '')
  const [version, setVersion] = useState('')
  const [usersInput, setUsersInput] = useState(searchParams.get('users') || '5')
  const [rampUp, setRampUp] = useState(searchParams.get('rampUp') !== 'false')
  const [rampUpDurationInput, setRampUpDurationInput] = useState(searchParams.get('rampUpDuration') || '10')
  const [durationInput, setDurationInput] = useState(searchParams.get('duration') || '20')
  const [loop, setLoop] = useState(searchParams.get('loop') !== 'false')
  const users = parseInt(usersInput) || 1
  const rampUpDuration = parseInt(rampUpDurationInput) || 1
  const duration = parseInt(durationInput) || 1
  const [bandwidthLimitMbps, setBandwidthLimitMbps] = useState<number | undefined>(
    searchParams.get('bandwidthLimitMbps') ? Number(searchParams.get('bandwidthLimitMbps')) : undefined
  )
  const [running, setRunning] = useState<TestRun | null>(null)
  const [queuedTests, setQueuedTests] = useState<TestRun[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [gatlingError, setGatlingError] = useState('')
  const [gatlingLoading, setGatlingLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const navigate = useNavigate()
  const { queue: wsQueue } = useQueueWebSocket()

  // --- Selenium state ---
  const [seClasses, setSeClasses] = useState<string[]>([])
  const [scriptClass, setScriptClass] = useState(searchParams.get('scriptClass') || '')
  const [browser, setBrowser] = useState('chrome')
  const [instances, setInstances] = useState(1)
  const [seVersion, setSeVersion] = useState('')
  const [headless, setHeadless] = useState(false)
  const [loops, setLoops] = useState(1)
  const [rampUpSeconds, setRampUpSeconds] = useState(0)
  const [gridStatus, setGridStatus] = useState<{ status: string; url: string }>({ status: 'UNKNOWN', url: '' })
  const [seLaunching, setSeLaunching] = useState(false)
  const [seError, setSeError] = useState('')
  const [recentSeTests, setRecentSeTests] = useState<SeleniumTestRun[]>([])
  const [seLoading, setSeLoading] = useState(true)

  useEffect(() => {
    setGatlingLoading(true)
    Promise.all([
      fetchSimulationClasses().then((c) => {
        setClasses(c)
        const fromParams = searchParams.get('simulationClass')
        if (fromParams && c.includes(fromParams)) setSelected(fromParams)
        else if (c.length > 0 && !selected) setSelected(c[0])
      }),
      fetchRunningTest().then(setRunning),
      fetchQueue().then(setQueuedTests),
      fetchSummary().then(setSummary).catch(() => {}),
    ]).finally(() => setGatlingLoading(false))
  }, [])

  useEffect(() => {
    setSeLoading(true)
    Promise.all([
      fetchSeleniumClasses().then(c => {
        setSeClasses(c)
        const fromParams = searchParams.get('scriptClass')
        if (fromParams && c.includes(fromParams)) setScriptClass(fromParams)
      }).catch(() => {}),
      fetchGridStatus().then(setGridStatus).catch(() => {}),
      fetchSeleniumTests({ page: 0, size: 5 }).then(p => setRecentSeTests(p.content)).catch(() => {}),
    ]).finally(() => setSeLoading(false))
  }, [])

  useEffect(() => {
    if (wsQueue.length > 0 || queuedTests.length > 0) {
      setQueuedTests(wsQueue as TestRun[])
    }
  }, [wsQueue])

  async function handleGatlingLaunch() {
    setGatlingError('')
    setLaunching(true)
    try {
      const run = await launchTest({
        simulationClass: selected,
        version: version || undefined,
        users,
        rampUp,
        rampUpDuration,
        duration,
        loop,
        bandwidthLimitMbps: bandwidthLimitMbps || undefined,
      })
      if (run.status === 'QUEUED') {
        setQueuedTests(prev => [...prev, run])
      }
      navigate(`/test/${run.id}`)
    } catch (e: unknown) {
      setGatlingError(e instanceof Error ? e.message : 'Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  async function handleSeleniumLaunch() {
    if (!scriptClass) { setSeError('Please select a script class'); return }
    setSeLaunching(true)
    setSeError('')
    try {
      const run = await launchSeleniumTest({ scriptClass, browser, instances, version: seVersion || undefined, headless, loops, rampUpSeconds })
      navigate(`/selenium/test/${run.id}`)
    } catch (e: unknown) {
      setSeError((e as Error).message)
    } finally {
      setSeLaunching(false)
    }
  }

  const statusColor = gridStatus.status === 'READY' ? '#4ade80'
    : gridStatus.status === 'STARTING' ? '#facc15' : '#f87171'

  const rampUpInfo = rampUpSeconds > 0 && instances > 1
    ? `1 nouveau browser toutes les ${(rampUpSeconds / (instances - 1)).toFixed(1)}s`
    : null

  if (gatlingLoading && seLoading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      {summary && (
        <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Tests (24h)</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>{summary.tests24h}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Success Rate (24h)</div>
            <div style={{ fontSize: '1.5rem', color: summary.successRate24h >= 80 ? '#27ae60' : '#e94560' }}>
              {summary.successRate24h}%
            </div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Avg RT (24h)</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>
              {summary.avgResponseTime24h != null ? `${summary.avgResponseTime24h} ms` : '-'}
            </div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total Tests</div>
            <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>{summary.totalTests}</div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1rem' }}>
        <button
          className={`btn ${activeTab === 'gatling' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 0 0 6px', padding: '0.4rem 1.2rem' }}
          onClick={() => setActiveTab('gatling')}
        >Gatling</button>
        <button
          className={`btn ${activeTab === 'selenium' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '0 6px 6px 0', padding: '0.4rem 1.2rem' }}
          onClick={() => setActiveTab('selenium')}
        >Selenium</button>
      </div>

      {activeTab === 'gatling' && (
        <>
          {running && (
            <div className="card">
              <h3>Test in progress</h3>
              <p>
                <strong>{running.simulationClass}</strong>{' '}
                <span className="status-badge status-RUNNING">RUNNING</span>
              </p>
              <button className="btn btn-primary" style={{ marginTop: '0.5rem' }}
                onClick={() => navigate(`/test/${running.id}`)}>
                View live
              </button>
            </div>
          )}

          <div className="card">
            <h3>Launch a test</h3>
            <div className="flex-row" style={{ marginTop: '0.8rem' }}>
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {classes.length === 0 && <option>No simulations found</option>}
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Version (optional)"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Users
                <input
                  type="number" min={1} value={usersInput}
                  onChange={(e) => setUsersInput(e.target.value)}
                  onBlur={() => { const v = parseInt(usersInput); if (isNaN(v) || v < 1) setUsersInput('1') }}
                  style={{ width: '80px' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={rampUp} onChange={(e) => setRampUp(e.target.checked)} />
                Ramp-up
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: rampUp ? 1 : 0.5 }}>
                Ramp-up duration (s)
                <input
                  type="number" min={1} value={rampUpDurationInput}
                  onChange={(e) => setRampUpDurationInput(e.target.value)}
                  onBlur={() => { const v = parseInt(rampUpDurationInput); if (isNaN(v) || v < 1) setRampUpDurationInput('1') }}
                  style={{ width: '80px' }} disabled={!rampUp}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                Loop scenario
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Duration (s)
                <input
                  type="number" min={1} value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  onBlur={() => { const v = parseInt(durationInput); if (isNaN(v) || v < 1) setDurationInput('1') }}
                  style={{ width: '80px' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Bandwidth limit (Mbps)
                <input
                  type="number" min={1} placeholder="No limit"
                  value={bandwidthLimitMbps ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setBandwidthLimitMbps(isNaN(val) || val <= 0 ? undefined : val)
                  }}
                  style={{ width: '80px' }}
                />
              </label>
            </div>

            <InjectionProfileChart users={users} rampUp={rampUp} rampUpDuration={rampUpDuration} duration={duration} loop={loop} />

            <div style={{ marginTop: '0.8rem' }}>
              <button className="btn btn-primary" onClick={handleGatlingLaunch} disabled={!selected || launching}>
                {launching ? 'Launching...' : 'Launch'}
              </button>
            </div>
            {gatlingError && <p style={{ color: '#e94560', marginTop: '0.5rem' }}>{gatlingError}</p>}
          </div>

          {queuedTests.length > 0 && (
            <div className="card">
              <h3>Queued Tests ({queuedTests.length})</h3>
              <table style={{ marginTop: '0.5rem' }}>
                <thead>
                  <tr>
                    <th>ID</th><th>Simulation</th><th>Version</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queuedTests.map((t) => (
                    <tr key={t.id}>
                      <td>#{t.id}</td>
                      <td>{t.simulationClass}</td>
                      <td>{t.version || '-'}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', color: '#e94560' }}
                          onClick={async () => {
                            await cancelQueuedTest(t.id)
                            setQueuedTests(prev => prev.filter(q => q.id !== t.id))
                          }}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'selenium' && (
        <>
          <div className="card">
            <h3>Launch Selenium Test</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Script Class</label>
                <select value={scriptClass} onChange={(e) => setScriptClass(e.target.value)} style={{ width: '100%' }}>
                  <option value="">-- Select script --</option>
                  {seClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Browser</label>
                <select value={browser} onChange={(e) => setBrowser(e.target.value)} style={{ width: '100%' }}>
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Instances (1-20)</label>
                <input type="number" min={1} max={20} value={instances}
                  onChange={(e) => setInstances(Math.max(1, Math.min(20, Number(e.target.value))))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Version (optional)</label>
                <input type="text" placeholder="v1.0" value={seVersion}
                  onChange={(e) => setSeVersion(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Loops (1-100)</label>
                <input type="number" min={1} max={100} value={loops}
                  onChange={(e) => setLoops(Math.max(1, Math.min(100, Number(e.target.value))))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Ramp-up (0-600s)</label>
                <input type="number" min={0} max={600} value={rampUpSeconds}
                  onChange={(e) => setRampUpSeconds(Math.max(0, Math.min(600, Number(e.target.value))))}
                  style={{ width: '100%' }} />
                {rampUpInfo && (
                  <div style={{ color: '#60a5fa', fontSize: '0.75rem', marginTop: '0.2rem' }}>{rampUpInfo}</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="se-headless" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
              <label htmlFor="se-headless" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                Mode headless (navigateur invisible)
              </label>
            </div>

            <div className="flex-row" style={{ marginTop: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Drivers: {gridStatus.status}</span>
              </div>
              <button className="btn btn-primary" onClick={handleSeleniumLaunch} disabled={seLaunching || !scriptClass}>
                {seLaunching ? 'Launching...' : 'Launch Test'}
              </button>
            </div>
            {seError && <div style={{ color: '#f87171', marginTop: '0.5rem', fontSize: '0.85rem' }}>{seError}</div>}
          </div>

          {recentSeTests.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3>Recent Selenium Tests</h3>
              <table className="data-table" style={{ marginTop: '0.5rem' }}>
                <thead>
                  <tr>
                    <th>ID</th><th>Script</th><th>Browser</th><th>Instances</th><th>Loops</th><th>Status</th><th>Result</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSeTests.map(t => (
                    <tr key={t.id}>
                      <td>#{t.id}</td>
                      <td>{t.scriptClass}</td>
                      <td>{t.browser}</td>
                      <td>{t.instances}</td>
                      <td>{t.loops ?? 1}</td>
                      <td>
                        <span className={`status-badge status-${t.status.toLowerCase()}`}>{t.status}</span>
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
                          onClick={() => navigate(`/selenium/test/${t.id}`)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InjectionProfileChart({ users, rampUp, rampUpDuration, duration, loop }: {
  users: number; rampUp: boolean; rampUpDuration: number; duration: number; loop: boolean
}) {
  const data = useMemo(() => {
    const points: { time: number; usersPerSec: number }[] = []
    if (loop) {
      if (rampUp) {
        const effectiveRampUp = Math.min(rampUpDuration, duration)
        const steps = Math.max(effectiveRampUp, 1)
        for (let t = 0; t <= steps; t++) {
          points.push({ time: t, usersPerSec: 1 + (users - 1) * (t / steps) })
        }
        if (duration > rampUpDuration) {
          points.push({ time: rampUpDuration, usersPerSec: users })
          points.push({ time: duration, usersPerSec: users })
        }
      } else {
        points.push({ time: 0, usersPerSec: users })
        points.push({ time: duration, usersPerSec: users })
      }
    } else {
      if (rampUp) {
        points.push({ time: 0, usersPerSec: 0 })
        points.push({ time: rampUpDuration, usersPerSec: users })
        points.push({ time: rampUpDuration + 1, usersPerSec: 0 })
      } else {
        points.push({ time: 0, usersPerSec: users })
        points.push({ time: 1, usersPerSec: 0 })
      }
    }
    return points
  }, [users, rampUp, rampUpDuration, duration, loop])

  const totalTime = loop ? duration : (rampUp ? rampUpDuration + 1 : 2)

  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ marginBottom: '0.4rem' }}>Injection profile</h4>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis
            dataKey="time" type="number" domain={[0, totalTime]}
            tickFormatter={(v) => `${v}s`} stroke="var(--text-secondary)"
          />
          <YAxis
            domain={[0, (max: number) => Math.ceil(max * 1.2) || 1]}
            stroke="var(--text-secondary)"
            label={{ value: 'users/s', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)' } }}
          />
          <Tooltip
            formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : '0', 'users/s']}
            labelFormatter={(label) => `${label}s`}
          />
          <Area type="linear" dataKey="usersPerSec" stroke="#00d2ff" fill="#00d2ff" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
