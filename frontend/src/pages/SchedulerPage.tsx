import { useState, useEffect } from 'react'
import { fetchScheduledJobs, createScheduledJob, cancelScheduledJob, type ScheduledJob } from '../api/schedulerApi'
import { fetchSimulationClasses } from '../api/simulationApi'
import { fetchSeleniumClasses } from '../api/seleniumApi'
import { Button, Card, PageHeader, Spinner, Alert } from '../components/ui'

function formatCountdown(scheduledAt: number): string {
  const diff = scheduledAt - Date.now()
  if (diff <= 0) return 'Due'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function statusColor(status: string): string {
  switch (status) {
    case 'PENDING': return '#facc15'
    case 'LAUNCHED': return '#4ade80'
    case 'CANCELLED': return 'var(--color-text-2)'
    case 'FAILED': return '#f87171'
    default: return 'var(--color-text)'
  }
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [testType, setTestType] = useState<'gatling' | 'selenium'>('gatling')
  const [gatlingClasses, setGatlingClasses] = useState<string[]>([])
  const [seleniumClasses, setSeleniumClasses] = useState<string[]>([])
  const [scriptClass, setScriptClass] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)

  // Gatling params
  const [users, setUsers] = useState(10)
  const [duration, setDuration] = useState(60)
  const [rampUp, setRampUp] = useState(false)
  const [rampUpDuration, setRampUpDuration] = useState(30)

  // Selenium params
  const [browser, setBrowser] = useState('chrome')
  const [instances, setInstances] = useState(1)
  const [headless, setHeadless] = useState(true)
  const [loops, setLoops] = useState(1)
  const [rampUpSeconds, setRampUpSeconds] = useState(0)

  useEffect(() => {
    loadJobs()
    fetchSimulationClasses().then(c => { setGatlingClasses(c); if (c.length > 0) setScriptClass(c[0]) }).catch(() => {})
    fetchSeleniumClasses().then(setSeleniumClasses).catch(() => {})
    const interval = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const classes = testType === 'gatling' ? gatlingClasses : seleniumClasses
    if (classes.length > 0) setScriptClass(classes[0])
    else setScriptClass('')
  }, [testType, gatlingClasses, seleniumClasses])

  async function loadJobs() {
    setLoading(true)
    fetchScheduledJobs().then(setJobs).catch(() => {}).finally(() => setLoading(false))
  }

  function buildLaunchParamsJson(): string {
    if (testType === 'gatling') {
      return JSON.stringify({
        simulationClass: scriptClass,
        users,
        duration,
        rampUp,
        rampUpDuration: rampUp ? rampUpDuration : null,
      })
    } else {
      return JSON.stringify({
        scriptClass,
        browser,
        instances,
        headless,
        loops,
        rampUpSeconds,
      })
    }
  }

  async function handleCreate() {
    if (!scriptClass || !scheduledAt) { setError('Script class and date/time are required'); return }
    const scheduledMs = new Date(scheduledAt).getTime()
    if (isNaN(scheduledMs)) { setError('Invalid date/time'); return }
    if (scheduledMs <= Date.now()) { setError('Scheduled time must be in the future'); return }
    setSubmitting(true)
    setError('')
    try {
      const job = await createScheduledJob({
        testType,
        scriptClass,
        launchParamsJson: buildLaunchParamsJson(),
        scheduledAt: scheduledMs,
        status: 'PENDING',
        notes: notes || null,
      })
      setJobs(prev => [...prev, job].sort((a, b) => a.scheduledAt - b.scheduledAt))
      setNotes('')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: number) {
    await cancelScheduledJob(id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'CANCELLED' as const } : j))
  }

  const labelStyle: React.CSSProperties = { color: 'var(--color-text-2)', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }

  return (
    <div>
      <PageHeader title="Scheduler" breadcrumb="Système / Scheduler" />

      <Card style={{ marginBottom: '1rem' }}>
        <h3>Schedule a Test</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={testType} onChange={(e) => setTestType(e.target.value as 'gatling' | 'selenium')} style={{ width: '100%' }}>
              <option value="gatling">Gatling</option>
              <option value="selenium">Selenium</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              {testType === 'gatling' ? 'Simulation Class' : 'Script Class'}
            </label>
            <select value={scriptClass} onChange={(e) => setScriptClass(e.target.value)} style={{ width: '100%' }}>
              {(testType === 'gatling' ? gatlingClasses : seleniumClasses).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {(testType === 'gatling' ? gatlingClasses : seleniumClasses).length === 0 && (
                <option value="">No classes found</option>
              )}
            </select>
          </div>

          {/* Gatling-specific params */}
          {testType === 'gatling' && (
            <>
              <div>
                <label style={labelStyle}>Users</label>
                <input type="number" min={1} value={users} onChange={e => setUsers(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Duration (s)</label>
                <input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="rampUp" checked={rampUp} onChange={e => setRampUp(e.target.checked)} />
                <label htmlFor="rampUp" style={{ color: 'var(--color-text-2)', fontSize: '0.85rem' }}>Ramp-up</label>
              </div>
              {rampUp && (
                <div>
                  <label style={labelStyle}>Ramp-up Duration (s)</label>
                  <input type="number" min={1} value={rampUpDuration} onChange={e => setRampUpDuration(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              )}
            </>
          )}

          {/* Selenium-specific params */}
          {testType === 'selenium' && (
            <>
              <div>
                <label style={labelStyle}>Browser</label>
                <select value={browser} onChange={e => setBrowser(e.target.value)} style={{ width: '100%' }}>
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Instances</label>
                <input type="number" min={1} max={20} value={instances} onChange={e => setInstances(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Loops</label>
                <input type="number" min={1} max={100} value={loops} onChange={e => setLoops(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Ramp-up (s)</label>
                <input type="number" min={0} max={600} value={rampUpSeconds} onChange={e => setRampUpSeconds(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="headless" checked={headless} onChange={e => setHeadless(e.target.checked)} />
                <label htmlFor="headless" style={{ color: 'var(--color-text-2)', fontSize: '0.85rem' }}>Headless</label>
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>Scheduled Date/Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              type="text"
              placeholder="Description..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {error && <Alert variant="error" style={{ marginTop: '0.5rem' }}>{error}</Alert>}
        <div style={{ marginTop: '1rem' }}>
          <Button variant="primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Scheduling...' : 'Schedule'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3>Scheduled Jobs</h3>
        {loading ? (
          <Spinner />
        ) : jobs.length === 0 ? (
          <div style={{ color: 'var(--color-text-2)', textAlign: 'center', padding: '1rem' }}>No scheduled jobs</div>
        ) : (
          <table className="data-table" style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Class</th>
                <th>Scheduled At</th>
                <th>Countdown</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>#{job.id}</td>
                  <td style={{ textTransform: 'capitalize' }}>{job.testType}</td>
                  <td>{job.scriptClass}</td>
                  <td>{new Date(job.scheduledAt).toLocaleString()}</td>
                  <td>{job.status === 'PENDING' ? formatCountdown(job.scheduledAt) : '-'}</td>
                  <td>
                    <span style={{ color: statusColor(job.status), fontWeight: 600 }}>{job.status}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-2)' }}>{job.notes || '-'}</td>
                  <td>
                    {job.status === 'PENDING' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', color: '#f87171' }}
                        onClick={() => handleCancel(job.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
