import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchTestRun, cancelTest, cancelQueuedTest, updateTestLabels, fetchTestMetrics, fetchInfraMetrics, type TestRun } from '../api/testRunApi'
import { useMetricsWebSocket, useTestStatusWebSocket, useLogsWebSocket } from '../hooks/useWebSocket'
import type { MetricsSnapshot } from '../api/testRunApi'
import { useInfraMetricsWebSocket, type InfraMetricsSnapshot } from '../hooks/useInfraMetricsWebSocket'
import ErrorBoundary from '../components/ErrorBoundary'
import InfraMetricsPanel from '../components/InfraMetricsPanel'
import ThresholdDetailsPanel from '../components/ThresholdDetailsPanel'

// Moyenne mobile pour lisser les courbes
function smoothData(data: MetricsSnapshot[], windowSize = 3): MetricsSnapshot[] {
  if (data.length === 0) return []
  if (data.length < windowSize) return data
  return data.map((point, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const windowSlice = data.slice(start, i + 1)
    const len = windowSlice.length
    const avgRps = windowSlice.reduce((sum, p) => sum + (p.requestsPerSecond || 0), 0) / len
    const avgEps = windowSlice.reduce((sum, p) => sum + (p.errorsPerSecond || 0), 0) / len
    const avgMeanRt = windowSlice.reduce((sum, p) => sum + (p.meanResponseTime || 0), 0) / len
    const avgP50 = windowSlice.reduce((sum, p) => sum + (p.p50 || 0), 0) / len
    const avgP75 = windowSlice.reduce((sum, p) => sum + (p.p75 || 0), 0) / len
    const avgP95 = windowSlice.reduce((sum, p) => sum + (p.p95 || 0), 0) / len
    const avgP99 = windowSlice.reduce((sum, p) => sum + (p.p99 || 0), 0) / len
    return {
      ...point,
      requestsPerSecond: avgRps,
      errorsPerSecond: avgEps,
      meanResponseTime: avgMeanRt,
      p50: avgP50,
      p75: avgP75,
      p95: avgP95,
      p99: avgP99,
    }
  })
}

interface ChartDataPoint {
  time: number
  requestsPerSecond: number
  errorsPerSecond: number
  meanResponseTime: number
  activeUsers: number
}

function downsampleForChart(data: ChartDataPoint[], maxPoints = 300): ChartDataPoint[] {
  if (data.length <= maxPoints) return data
  const bucketSize = Math.ceil(data.length / maxPoints)
  const result: ChartDataPoint[] = []
  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, Math.min(i + bucketSize, data.length))
    const len = bucket.length
    result.push({
      time: bucket[Math.floor(len / 2)].time,
      requestsPerSecond: bucket.reduce((s, p) => s + p.requestsPerSecond, 0) / len,
      errorsPerSecond: bucket.reduce((s, p) => s + p.errorsPerSecond, 0) / len,
      meanResponseTime: bucket.reduce((s, p) => s + p.meanResponseTime, 0) / len,
      activeUsers: bucket.reduce((s, p) => s + p.activeUsers, 0) / len,
    })
  }
  return result
}

function formatTime(sec: unknown): string {
  const num = Number(sec)
  if (isNaN(num)) return '0s'
  const m = Math.floor(num / 60)
  const s = Math.floor(num % 60)
  return m > 0 ? `${m}m${s}s` : `${s}s`
}

const LABEL_COLORS = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e74c3c', '#2ecc71', '#34495e']
function hashStr(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}
function getLabelColor(label: string): string { return LABEL_COLORS[hashStr(label) % LABEL_COLORS.length] }

type TabType = 'gatling' | 'infra'

export default function TestMonitorPage() {
  const { id } = useParams<{ id: string }>()
  const testId = Number(id)
  const navigate = useNavigate()
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('gatling')
  const [addingLabel, setAddingLabel] = useState('')
  const [showAddLabel, setShowAddLabel] = useState(false)
  const [historicalMetrics, setHistoricalMetrics] = useState<MetricsSnapshot[]>([])
  const [historicalInfra, setHistoricalInfra] = useState<InfraMetricsSnapshot[]>([])
  const { metrics: liveMetrics, connected } = useMetricsWebSocket(testId)
  const { metrics: liveInfraMetrics, connected: infraConnected } = useInfraMetricsWebSocket(testId)
  const { logs } = useLogsWebSocket(testId)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const handleStatusChange = useCallback((status: string) => {
    if (status.startsWith('VERDICT:')) {
      // Threshold verdict received, refetch full data
      fetchTestRun(testId).then(setTestRun)
      return
    }
    setTestRun((prev) => prev ? { ...prev, status: status as TestRun['status'] } : prev)
    if (status !== 'RUNNING') {
      fetchTestRun(testId).then(setTestRun)
      fetchTestMetrics(testId).then(setHistoricalMetrics).catch(() => {})
      fetchInfraMetrics(testId).then(data => setHistoricalInfra(data as InfraMetricsSnapshot[])).catch(() => {})
    }
  }, [testId])

  useTestStatusWebSocket(testId, handleStatusChange)

  useEffect(() => {
    setLoading(true)
    setHistoricalMetrics([])
    setHistoricalInfra([])
    fetchTestRun(testId).then((run) => {
      setTestRun(run)
      if (run.status !== 'RUNNING' && run.status !== 'QUEUED') {
        fetchTestMetrics(testId).then(setHistoricalMetrics).catch(() => {})
        fetchInfraMetrics(testId).then(data => setHistoricalInfra(data as InfraMetricsSnapshot[])).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [testId])

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, showLogs])

  async function handleCancel() {
    await cancelTest(testId)
    setTestRun((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev)
  }

  // Use live metrics while running, historical metrics when finished
  const metrics = testRun?.status === 'RUNNING' ? liveMetrics : (historicalMetrics.length > 0 ? historicalMetrics : liveMetrics)
  const infraMetrics = testRun?.status === 'RUNNING' ? liveInfraMetrics : (historicalInfra.length > 0 ? historicalInfra : liveInfraMetrics)

  // Lissage des données avec moyenne mobile sur 3 points
  const smoothedMetrics = useMemo(() => smoothData(metrics, 3), [metrics])
  const startTs = metrics[0]?.timestamp || Date.now()

  const chartData = useMemo(() => {
    const mapped = smoothedMetrics.map((m) => ({
      time: Math.round((m.timestamp - startTs) / 1000),
      requestsPerSecond: m.requestsPerSecond || 0,
      errorsPerSecond: m.errorsPerSecond || 0,
      meanResponseTime: m.meanResponseTime || 0,
      activeUsers: m.activeUsers || 0,
    }))
    return downsampleForChart(mapped, 300)
  }, [smoothedMetrics, startTs])

  if (loading) {
    return <div className="loading-spinner">Loading...</div>
  }

  if (!testRun) {
    return <div className="card">Test not found</div>
  }

  const last = metrics[metrics.length - 1]
  const tooltipStyle = { background: '#16213e', border: '1px solid #0f3460' }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {testRun.simulationClass}
        </h1>
        <span className={`status-badge status-${testRun.status}`}>{testRun.status}</span>
        {testRun.thresholdVerdict && (
          <span className={`verdict-badge verdict-${testRun.thresholdVerdict}`}>{testRun.thresholdVerdict}</span>
        )}
        {testRun.bandwidthLimitMbps && (
          <span style={{ color: '#e67e22', fontSize: '0.85rem', fontWeight: 500 }}>
            Bandwidth: {testRun.bandwidthLimitMbps} Mbps
          </span>
        )}
        <span className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
        {testRun.status === 'RUNNING' && (
          <button className="btn btn-danger" onClick={handleCancel}>Cancel</button>
        )}
        {testRun.status === 'QUEUED' && (
          <button className="btn btn-danger" onClick={async () => {
            await cancelQueuedTest(testId)
            setTestRun((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev)
          }}>Cancel Queue</button>
        )}
        {testRun.reportPath && (
          <a href={`/reports/${testRun.reportPath}/index.html`} target="_blank"
            className="btn btn-secondary" rel="noreferrer">View Report</a>
        )}
        {testRun.status !== 'RUNNING' && testRun.status !== 'QUEUED' && (
          <a href={`/api/tests/${testId}/export/pdf`} className="btn btn-secondary">Download PDF</a>
        )}
        <button className="btn btn-secondary" onClick={() => setShowLogs(!showLogs)}>
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/history')}>
          Back to History
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginBottom: '1rem' }}>
        {(testRun.labels || []).map((label) => (
          <span key={label} className="label-badge"
            style={{ borderColor: getLabelColor(label), color: getLabelColor(label) }}>
            {label}
            <span style={{ marginLeft: '0.3rem', cursor: 'pointer', opacity: 0.7 }}
              onClick={async () => {
                const newLabels = (testRun.labels || []).filter(l => l !== label)
                await updateTestLabels(testId, newLabels)
                setTestRun(prev => prev ? { ...prev, labels: newLabels } : prev)
              }}>&times;</span>
          </span>
        ))}
        {showAddLabel ? (
          <div className="flex-row" style={{ gap: '0.3rem' }}>
            <input type="text" value={addingLabel} onChange={(e) => setAddingLabel(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && addingLabel.trim()) {
                  const newLabels = [...(testRun.labels || []), addingLabel.trim()]
                  await updateTestLabels(testId, newLabels)
                  setTestRun(prev => prev ? { ...prev, labels: newLabels } : prev)
                  setAddingLabel(''); setShowAddLabel(false)
                }
              }}
              style={{ width: '100px', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }} autoFocus />
            <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
              onClick={async () => {
                if (!addingLabel.trim()) return
                const newLabels = [...(testRun.labels || []), addingLabel.trim()]
                await updateTestLabels(testId, newLabels)
                setTestRun(prev => prev ? { ...prev, labels: newLabels } : prev)
                setAddingLabel(''); setShowAddLabel(false)
              }}>Add</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
              onClick={() => { setShowAddLabel(false); setAddingLabel('') }}>&times;</button>
          </div>
        ) : (
          <span style={{ cursor: 'pointer', color: '#a0a0b8', fontSize: '0.8rem' }}
            onClick={() => setShowAddLabel(true)}>+ Label</span>
        )}
      </div>

      {testRun.status === 'QUEUED' && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner">Waiting in queue...</div>
          <p style={{ color: '#a0a0b8', marginTop: '0.5rem' }}>This test will start automatically when the current test finishes.</p>
        </div>
      )}

      {last && (
        <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>Total Requests</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>{last.totalRequests ?? 0}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>Mean RT</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>{(last.meanResponseTime ?? 0).toFixed(0)} ms</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>Active Users</div>
            <div style={{ fontSize: '1.5rem', color: '#fff' }}>{last.activeUsers ?? 0}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>Errors</div>
            <div style={{ fontSize: '1.5rem', color: '#e94560' }}>{last.totalErrors ?? 0}</div>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Maven Output</h3>
          <div style={{
            background: '#0d0d0d',
            padding: '0.5rem',
            borderRadius: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.4,
          }}>
            {logs.length === 0 ? (
              <span style={{ color: '#666' }}>Waiting for output...</span>
            ) : (
              logs.map((line, i) => {
                const text = typeof line === 'string' ? line : String(line)
                return (
                  <div key={i} style={{ color: text.includes('ERROR') ? '#e94560' : '#a0a0b8' }}>
                    {text}
                  </div>
                )
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {testRun.thresholdVerdict && testRun.thresholdDetails && testRun.thresholdDetails.length > 0 && (
        <ThresholdDetailsPanel details={testRun.thresholdDetails} verdict={testRun.thresholdVerdict} />
      )}

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${activeTab === 'gatling' ? 'active' : ''}`}
          onClick={() => setActiveTab('gatling')}
        >
          Gatling Metrics
        </button>
        <button
          className={`tab-btn ${activeTab === 'infra' ? 'active' : ''}`}
          onClick={() => setActiveTab('infra')}
        >
          Infrastructure
        </button>
      </div>

      {activeTab === 'infra' ? (
        <ErrorBoundary fallback={<div className="card">Failed to render infrastructure metrics</div>}>
          <InfraMetricsPanel metrics={infraMetrics} connected={infraConnected} />
        </ErrorBoundary>
      ) : (
      <ErrorBoundary fallback={<div className="card">Failed to render charts</div>}>
        <div className="charts-grid">
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Requests/s</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [(Number(value) || 0).toFixed(2), 'req/s']} />
                <Line type="monotone" dataKey="requestsPerSecond" stroke="#2980b9" dot={false} name="req/s" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Mean Response Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(0)} ms`, 'Mean RT']} />
                <Line type="monotone" dataKey="meanResponseTime" stroke="#e67e22" dot={false} name="Mean RT (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Active Users</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value) || 0, 'users']} />
                <Line type="monotone" dataKey="activeUsers" stroke="#9b59b6" dot={false} name="users" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Errors/s</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [(Number(value) || 0).toFixed(2), 'err/s']} />
                <Line type="monotone" dataKey="errorsPerSecond" stroke="#e94560" dot={false} name="err/s" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ErrorBoundary>
      )}
    </div>
  )
}
