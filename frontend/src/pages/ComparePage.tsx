import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts'
import { fetchComparison, type ComparisonResult } from '../api/comparisonApi'
import { fetchTestMetrics, type TestRun, type MetricsSnapshot } from '../api/testRunApi'

const LABEL_COLORS = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e74c3c', '#2ecc71', '#34495e']
function hashStr(s: string) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 } return Math.abs(h) }
function getLabelColor(l: string) { return LABEL_COLORS[hashStr(l) % LABEL_COLORS.length] }

const METRIC_LABELS: Record<string, string> = {
  meanResponseTime: 'Mean RT (ms)',
  p50ResponseTime: 'p50 (ms)',
  p75ResponseTime: 'p75 (ms)',
  p95ResponseTime: 'p95 (ms)',
  p99ResponseTime: 'p99 (ms)',
  totalRequests: 'Total Requests',
  errorRate: 'Error Rate (%)',
}

const RT_METRICS = ['meanResponseTime', 'p50ResponseTime', 'p75ResponseTime', 'p95ResponseTime', 'p99ResponseTime']

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleString() : '-'
}

function formatDuration(run: TestRun): string {
  if (!run.startTime || !run.endTime) return '-'
  const ms = new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

function getMetricValue(run: TestRun, metric: string): number | null {
  if (metric === 'errorRate') {
    const total = run.totalRequests ?? 0
    const errors = run.totalErrors ?? 0
    return total > 0 ? (errors / total) * 100 : 0
  }
  const map: Record<string, number | null> = {
    meanResponseTime: run.meanResponseTime,
    p50ResponseTime: run.p50ResponseTime,
    p75ResponseTime: run.p75ResponseTime,
    p95ResponseTime: run.p95ResponseTime,
    p99ResponseTime: run.p99ResponseTime,
    totalRequests: run.totalRequests,
  }
  return map[metric] ?? null
}

export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ComparisonResult | null>(null)
  const [metricsA, setMetricsA] = useState<MetricsSnapshot[]>([])
  const [metricsB, setMetricsB] = useState<MetricsSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ids = searchParams.get('ids')

  useEffect(() => {
    if (!ids) { setError('Missing ids parameter'); setLoading(false); return }
    const parts = ids.split(',').map(Number)
    if (parts.length !== 2 || parts.some(isNaN)) { setError('Invalid ids'); setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchComparison(parts[0], parts[1]),
      fetchTestMetrics(parts[0]).catch(() => []),
      fetchTestMetrics(parts[1]).catch(() => []),
    ])
      .then(([comp, mA, mB]) => {
        setData(comp)
        setMetricsA(mA)
        setMetricsB(mB)
      })
      .catch(() => setError('Failed to load comparison'))
      .finally(() => setLoading(false))
  }, [ids])

  const overlayData = useMemo(() => {
    if (metricsA.length === 0 && metricsB.length === 0) return []
    const startA = metricsA[0]?.timestamp || 0
    const startB = metricsB[0]?.timestamp || 0
    const maxLen = Math.max(metricsA.length, metricsB.length)
    const result: Record<string, number | null>[] = []
    for (let i = 0; i < maxLen; i++) {
      const a = metricsA[i]
      const b = metricsB[i]
      result.push({
        time: Math.round(((a?.timestamp ?? b?.timestamp ?? 0) - (a ? startA : startB)) / 1000),
        rpsA: a?.requestsPerSecond ?? null,
        rpsB: b?.requestsPerSecond ?? null,
        p95A: a?.p95 ?? null,
        p95B: b?.p95 ?? null,
        usersA: a?.activeUsers ?? null,
        usersB: b?.activeUsers ?? null,
      })
    }
    return result
  }, [metricsA, metricsB])

  if (loading) return <div className="loading-spinner">Loading comparison...</div>
  if (error) return <div className="card" style={{ color: '#e94560' }}>{error}</div>
  if (!data) return null

  const { testA, testB, diffPercent } = data
  const tooltipStyle = { background: '#16213e', border: '1px solid #0f3460' }

  const rtChartData = RT_METRICS.map(m => ({
    name: METRIC_LABELS[m],
    'Test A': getMetricValue(testA, m) ?? 0,
    'Test B': getMetricValue(testB, m) ?? 0,
  }))

  const throughputData = [
    { name: 'Total Requests', 'Test A': testA.totalRequests ?? 0, 'Test B': testB.totalRequests ?? 0 },
    { name: 'Total Errors', 'Test A': testA.totalErrors ?? 0, 'Test B': testB.totalErrors ?? 0 },
  ]

  const allMetrics = [...RT_METRICS, 'totalRequests', 'errorRate']

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}m${s}s` : `${s}s`
  }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Test Comparison</h1>
        <a href={`/api/tests/compare/export/pdf?ids=${testA.id},${testB.id}`} className="btn btn-secondary">Download PDF</a>
        <button className="btn btn-secondary" onClick={() => navigate('/history')}>Back to History</button>
      </div>

      {/* Test headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#a0a0b8', marginBottom: '0.3rem' }}>Test A (#{testA.id})</div>
          <div style={{ fontWeight: 600, color: '#2980b9', fontSize: '1.1rem' }}>{testA.simulationClass}</div>
          <div style={{ color: '#a0a0b8', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {formatDate(testA.startTime)} &middot; {formatDuration(testA)}
            {testA.version && <> &middot; v{testA.version}</>}
          </div>
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
            {(testA.labels || []).map(l => (
              <span key={l} className="label-badge" style={{ borderColor: getLabelColor(l), color: getLabelColor(l) }}>{l}</span>
            ))}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.8rem', color: '#a0a0b8', marginBottom: '0.3rem' }}>Test B (#{testB.id})</div>
          <div style={{ fontWeight: 600, color: '#e94560', fontSize: '1.1rem' }}>{testB.simulationClass}</div>
          <div style={{ color: '#a0a0b8', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {formatDate(testB.startTime)} &middot; {formatDuration(testB)}
            {testB.version && <> &middot; v{testB.version}</>}
          </div>
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
            {(testB.labels || []).map(l => (
              <span key={l} className="label-badge" style={{ borderColor: getLabelColor(l), color: getLabelColor(l) }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Response Times</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rtChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="name" stroke="#a0a0b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#a0a0b8" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} ms`]} />
              <Legend />
              <Bar dataKey="Test A" fill="#2980b9" />
              <Bar dataKey="Test B" fill="#e94560" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Throughput</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="name" stroke="#a0a0b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#a0a0b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Test A" fill="#2980b9" />
              <Bar dataKey="Test B" fill="#e94560" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Diff table */}
      <div className="card">
        <h3 style={{ marginBottom: '0.5rem' }}>Detailed Comparison</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Test A</th>
              <th>Test B</th>
              <th>Diff (%)</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {allMetrics.map(metric => {
              const valA = getMetricValue(testA, metric)
              const valB = getMetricValue(testB, metric)
              const diff = diffPercent[metric]
              // For RT and error rate: lower is better. For totalRequests: neutral (volume metric).
              const hasVerdict = metric !== 'totalRequests'
              const improved = hasVerdict && diff != null ? diff < 0 : null
              const degraded = hasVerdict && diff != null ? diff > 0 : null

              return (
                <tr key={metric}>
                  <td style={{ fontWeight: 600 }}>{METRIC_LABELS[metric]}</td>
                  <td>{valA != null ? valA.toFixed(1) : '-'}</td>
                  <td>{valB != null ? valB.toFixed(1) : '-'}</td>
                  <td style={{
                    color: improved ? '#27ae60' : degraded ? '#e94560' : '#a0a0b8',
                    fontWeight: 600,
                  }}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '-'}
                  </td>
                  <td>
                    {improved && <span style={{ color: '#27ae60' }}>&#9650; Better</span>}
                    {degraded && <span style={{ color: '#e94560' }}>&#9660; Worse</span>}
                    {!improved && !degraded && <span style={{ color: '#a0a0b8' }}>-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Time-Series Overlay */}
      {overlayData.length > 0 && (
        <div className="charts-grid" style={{ marginTop: '1rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Requests/s Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="rpsA" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="rpsB" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>p95 Response Time Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} formatter={(v) => [`${Number(v).toFixed(0)} ms`]} />
                <Legend />
                <Line type="monotone" dataKey="p95A" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="p95B" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Active Users Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
                <YAxis stroke="#a0a0b8" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="usersA" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="usersB" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
