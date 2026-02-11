import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchSimulationClasses } from '../api/simulationApi'
import { launchTest, fetchRunningTest, fetchQueue, cancelQueuedTest, fetchSummary, type TestRun, type DashboardSummary } from '../api/testRunApi'
import { useQueueWebSocket } from '../hooks/useWebSocket'

export default function DashboardPage() {
  const [classes, setClasses] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [version, setVersion] = useState('')
  const [usersInput, setUsersInput] = useState('5')
  const [rampUp, setRampUp] = useState(true)
  const [rampUpDurationInput, setRampUpDurationInput] = useState('10')
  const [durationInput, setDurationInput] = useState('20')
  const [loop, setLoop] = useState(true)

  // Derived numeric values
  const users = parseInt(usersInput) || 1
  const rampUpDuration = parseInt(rampUpDurationInput) || 1
  const duration = parseInt(durationInput) || 1
  const [bandwidthLimitMbps, setBandwidthLimitMbps] = useState<number | undefined>(undefined)
  const [running, setRunning] = useState<TestRun | null>(null)
  const [queuedTests, setQueuedTests] = useState<TestRun[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const navigate = useNavigate()
  const { queue: wsQueue } = useQueueWebSocket()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchSimulationClasses().then((c) => {
        setClasses(c)
        if (c.length > 0) setSelected(c[0])
      }),
      fetchRunningTest().then(setRunning),
      fetchQueue().then(setQueuedTests),
      fetchSummary().then(setSummary).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (wsQueue.length > 0 || queuedTests.length > 0) {
      setQueuedTests(wsQueue as TestRun[])
    }
  }, [wsQueue])

  async function handleLaunch() {
    setError('')
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
      setError(e instanceof Error ? e.message : 'Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
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

      {summary && (
        <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.8rem' }}>Tests (24h)</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>{summary.tests24h}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.8rem' }}>Success Rate (24h)</div>
            <div style={{ fontSize: '1.5rem', color: summary.successRate24h >= 80 ? '#27ae60' : '#e94560' }}>
              {summary.successRate24h}%
            </div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.8rem' }}>Avg RT (24h)</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>
              {summary.avgResponseTime24h != null ? `${summary.avgResponseTime24h} ms` : '-'}
            </div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.8rem' }}>Total Tests</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>{summary.totalTests}</div>
          </div>
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
              type="number"
              min={1}
              value={usersInput}
              onChange={(e) => setUsersInput(e.target.value)}
              onBlur={() => { const v = parseInt(usersInput); if (isNaN(v) || v < 1) setUsersInput('1') }}
              style={{ width: '80px' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={rampUp}
              onChange={(e) => setRampUp(e.target.checked)}
            />
            Ramp-up
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: rampUp ? 1 : 0.5 }}>
            Ramp-up duration (s)
            <input
              type="number"
              min={1}
              value={rampUpDurationInput}
              onChange={(e) => setRampUpDurationInput(e.target.value)}
              onBlur={() => { const v = parseInt(rampUpDurationInput); if (isNaN(v) || v < 1) setRampUpDurationInput('1') }}
              style={{ width: '80px' }}
              disabled={!rampUp}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            Loop scenario
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Duration (s)
            <input
              type="number"
              min={1}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={() => { const v = parseInt(durationInput); if (isNaN(v) || v < 1) setDurationInput('1') }}
              style={{ width: '80px' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Bandwidth limit (Mbps)
            <input
              type="number"
              min={1}
              placeholder="No limit"
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
          <button className="btn btn-primary" onClick={handleLaunch} disabled={!selected || launching}>
            {launching ? 'Launching...' : 'Launch'}
          </button>
        </div>
        {error && <p style={{ color: '#e94560', marginTop: '0.5rem' }}>{error}</p>}
      </div>

      {queuedTests.length > 0 && (
        <div className="card">
          <h3>Queued Tests ({queuedTests.length})</h3>
          <table style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Simulation</th>
                <th>Version</th>
                <th>Actions</th>
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
    </div>
  )
}

function InjectionProfileChart({ users, rampUp, rampUpDuration, duration, loop }: {
  users: number; rampUp: boolean; rampUpDuration: number; duration: number; loop: boolean
}) {
  const data = useMemo(() => {
    const points: { time: number; usersPerSec: number }[] = []
    if (loop) {
      // Loop mode: ramp-up is INCLUDED in total duration
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
      // No loop: single injection of users
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

  const totalTime = loop
    ? duration
    : (rampUp ? rampUpDuration + 1 : 2)

  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ marginBottom: '0.4rem' }}>Injection profile</h4>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, totalTime]}
            tickFormatter={(v) => `${v}s`}
            stroke="#888"
          />
          <YAxis
            domain={[0, (max: number) => Math.ceil(max * 1.2) || 1]}
            stroke="#888"
            label={{ value: 'users/s', angle: -90, position: 'insideLeft', style: { fill: '#888' } }}
          />
          <Tooltip
            formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : '0', 'users/s']}
            labelFormatter={(label) => `${label}s`}
          />
          <Area
            type="linear"
            dataKey="usersPerSec"
            stroke="#00d2ff"
            fill="#00d2ff"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
