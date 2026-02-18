import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts'
import {
  fetchSeleniumComparison, fetchSeleniumMetrics,
  type SeleniumComparisonResult, type SeleniumMetricsSnapshot, type SeleniumTestRun,
} from '../api/seleniumApi'
import { getLabelColor } from '../utils/labelColors'

const METRIC_LABELS: Record<string, string> = {
  meanStepDuration: 'Mean Step (ms)',
  p50: 'p50 (ms)',
  p75: 'p75 (ms)',
  p95: 'p95 (ms)',
  p99: 'p99 (ms)',
  totalIterations: 'Total Iterations',
  passedIterations: 'Passed Iterations',
  failedIterations: 'Failed Iterations',
  errorRate: 'Error Rate (%)',
  passedInstances: 'Passed Instances',
  failedInstances: 'Failed Instances',
}

const DURATION_METRICS = ['meanStepDuration', 'p50', 'p75', 'p95', 'p99']
const LOWER_IS_BETTER = new Set(['meanStepDuration', 'p50', 'p75', 'p95', 'p99', 'errorRate', 'failedIterations', 'failedInstances'])
const NEUTRAL_METRICS = new Set(['totalIterations', 'passedIterations', 'passedInstances'])

function parseLabels(labels: string): string[] {
  if (!labels) return []
  return labels.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

function formatDate(epochMs: number | null): string {
  if (!epochMs) return '-'
  return new Date(epochMs).toLocaleString()
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '-'
  const ms = end - start
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

export default function SeleniumComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SeleniumComparisonResult | null>(null)
  const [metricsA, setMetricsA] = useState<SeleniumMetricsSnapshot[]>([])
  const [metricsB, setMetricsB] = useState<SeleniumMetricsSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ids = searchParams.get('ids')

  useEffect(() => {
    if (!ids) { setError('Missing ids parameter'); setLoading(false); return }
    const parts = ids.split(',').map(Number)
    if (parts.length !== 2 || parts.some(isNaN)) { setError('Invalid ids'); setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchSeleniumComparison(parts[0], parts[1]),
      fetchSeleniumMetrics(parts[0]).catch(() => []),
      fetchSeleniumMetrics(parts[1]).catch(() => []),
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
        ipsA: a?.iterationsPerSecond ?? null,
        ipsB: b?.iterationsPerSecond ?? null,
        p95A: a?.p95 ?? null,
        p95B: b?.p95 ?? null,
        browsersA: a?.activeBrowsers ?? null,
        browsersB: b?.activeBrowsers ?? null,
      })
    }
    return result
  }, [metricsA, metricsB])

  if (loading) return <div className="loading-spinner">Loading comparison...</div>
  if (error) return <div className="card" style={{ color: '#e94560' }}>{error}</div>
  if (!data) return null

  const { testA, testB, diffPercent, aggregatedA, aggregatedB } = data
  const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--border-color)' }
  const labelsA = parseLabels(testA.labels)
  const labelsB = parseLabels(testB.labels)

  const durationChartData = DURATION_METRICS.map(m => ({
    name: METRIC_LABELS[m],
    'Test A': aggregatedA[m] ?? 0,
    'Test B': aggregatedB[m] ?? 0,
  }))

  const throughputData = [
    { name: 'Passed Iter.', 'Test A': aggregatedA.passedIterations ?? 0, 'Test B': aggregatedB.passedIterations ?? 0 },
    { name: 'Failed Iter.', 'Test A': aggregatedA.failedIterations ?? 0, 'Test B': aggregatedB.failedIterations ?? 0 },
  ]

  const allMetrics = Object.keys(METRIC_LABELS)

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}m${s}s` : `${s}s`
  }

  function renderTestHeader(run: SeleniumTestRun, label: string, color: string, labels: string[]) {
    return (
      <div className="card">
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{label} (#{run.id})</div>
        <div style={{ fontWeight: 600, color, fontSize: '1.1rem' }}>{run.scriptClass}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          {run.browser} &middot; {run.instances} instance{run.instances > 1 ? 's' : ''}
          {run.loops > 1 && <> &middot; {run.loops} loops</>}
          {run.version && <> &middot; v{run.version}</>}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
          {formatDate(run.startTime)} &middot; {formatDuration(run.startTime, run.endTime)}
        </div>
        <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
          {labels.map(l => (
            <span key={l} className="label-badge" style={{ borderColor: getLabelColor(l), color: getLabelColor(l) }}>{l}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Selenium Comparison</h1>
        <a href={`/api/selenium/compare/export/pdf?ids=${testA.id},${testB.id}`} className="btn btn-secondary">Download PDF</a>
        <button className="btn btn-secondary" onClick={() => navigate('/selenium/history')}>Back to History</button>
      </div>

      {/* Test headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {renderTestHeader(testA, 'Test A', '#2980b9', labelsA)}
        {renderTestHeader(testB, 'Test B', '#e94560', labelsB)}
      </div>

      {/* Charts */}
      <div className="charts-grid" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Step Durations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={durationChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-secondary)" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--text-secondary)" />
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
              const valA = aggregatedA[metric]
              const valB = aggregatedB[metric]
              const diff = diffPercent[metric]
              const isNeutral = NEUTRAL_METRICS.has(metric)
              const isLowerBetter = LOWER_IS_BETTER.has(metric)
              const hasVerdict = !isNeutral && diff != null
              const improved = hasVerdict ? (isLowerBetter ? diff < 0 : diff > 0) : false
              const degraded = hasVerdict ? (isLowerBetter ? diff > 0 : diff < 0) : false

              return (
                <tr key={metric}>
                  <td style={{ fontWeight: 600 }}>{METRIC_LABELS[metric]}</td>
                  <td>{valA != null ? valA.toFixed(1) : '-'}</td>
                  <td>{valB != null ? valB.toFixed(1) : '-'}</td>
                  <td style={{
                    color: improved ? '#27ae60' : degraded ? '#e94560' : 'var(--text-secondary)',
                    fontWeight: 600,
                  }}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '-'}
                  </td>
                  <td>
                    {improved && <span style={{ color: '#27ae60' }}>Better</span>}
                    {degraded && <span style={{ color: '#e94560' }}>Worse</span>}
                    {!improved && !degraded && <span style={{ color: 'var(--text-secondary)' }}>-</span>}
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
            <h3 style={{ marginBottom: '0.5rem' }}>Iterations/s Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" tickFormatter={formatTime} />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="ipsA" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="ipsB" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>p95 Step Duration Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" tickFormatter={formatTime} />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} formatter={(v) => [`${Number(v).toFixed(0)} ms`]} />
                <Legend />
                <Line type="monotone" dataKey="p95A" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="p95B" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Active Browsers Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-secondary)" tickFormatter={formatTime} />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="browsersA" stroke="#2980b9" dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="browsersB" stroke="#e94560" dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
