import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts'
import { fetchComparison, type ComparisonResult } from '../api/comparisonApi'
import { fetchTestMetrics, type TestRun, type MetricsSnapshot } from '../api/testRunApi'
import { getLabelColor } from '../utils/labelColors'
import { Button, Card, PageHeader, Spinner, Alert } from '../components/ui'
import { CHART_COLORS } from '../styles/chartColors'

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

function formatDate(d: number | null) {
  return d ? new Date(d).toLocaleString() : '-'
}

function formatDuration(run: TestRun): string {
  if (!run.startTime || !run.endTime) return '-'
  const ms = run.endTime - run.startTime
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

  if (loading) return <Spinner label="Chargement de la comparaison..." />
  if (error) return <Alert variant="error">{error}</Alert>
  if (!data) return null

  const { testA, testB, diffPercent } = data
  const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }

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
      <PageHeader
        title="Test Comparison"
        breadcrumb="Gatling / Comparaison"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href={`/api/tests/compare/export/pdf?ids=${testA.id},${testB.id}`} className="ui-btn ui-btn--secondary ui-btn--sm">Download PDF</a>
            <Button variant="secondary" size="sm" onClick={() => navigate('/history')}>Back to History</Button>
          </div>
        }
      />

      {/* Test headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <Card>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', marginBottom: '0.3rem' }}>Test A (#{testA.id})</div>
          <div style={{ fontWeight: 600, color: CHART_COLORS.primary, fontSize: '1.1rem' }}>{testA.simulationClass}</div>
          <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', marginTop: '0.3rem' }}>
            {formatDate(testA.startTime)} &middot; {formatDuration(testA)}
            {testA.version && <> &middot; v{testA.version}</>}
          </div>
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
            {(testA.labels || []).map(l => (
              <span key={l} className="label-badge" style={{ borderColor: getLabelColor(l), color: getLabelColor(l) }}>{l}</span>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-2)', marginBottom: '0.3rem' }}>Test B (#{testB.id})</div>
          <div style={{ fontWeight: 600, color: CHART_COLORS.error, fontSize: '1.1rem' }}>{testB.simulationClass}</div>
          <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', marginTop: '0.3rem' }}>
            {formatDate(testB.startTime)} &middot; {formatDuration(testB)}
            {testB.version && <> &middot; v{testB.version}</>}
          </div>
          <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
            {(testB.labels || []).map(l => (
              <span key={l} className="label-badge" style={{ borderColor: getLabelColor(l), color: getLabelColor(l) }}>{l}</span>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="charts-grid" style={{ marginBottom: '1rem' }}>
        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Response Times</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rtChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-text-2)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} ms`]} />
              <Legend />
              <Bar dataKey="Test A" fill={CHART_COLORS.primary} />
              <Bar dataKey="Test B" fill={CHART_COLORS.error} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Throughput</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-text-2)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Test A" fill={CHART_COLORS.primary} />
              <Bar dataKey="Test B" fill={CHART_COLORS.error} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Diff table */}
      <Card>
        <h3 style={{ marginBottom: '0.5rem' }}>Detailed Comparison</h3>
        <table className="data-table">
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
              const hasVerdict = metric !== 'totalRequests'
              const improved = hasVerdict && diff != null ? diff < 0 : null
              const degraded = hasVerdict && diff != null ? diff > 0 : null

              return (
                <tr key={metric}>
                  <td style={{ fontWeight: 600 }}>{METRIC_LABELS[metric]}</td>
                  <td>{valA != null ? valA.toFixed(1) : '-'}</td>
                  <td>{valB != null ? valB.toFixed(1) : '-'}</td>
                  <td style={{
                    color: improved ? 'var(--color-success)' : degraded ? 'var(--color-error)' : 'var(--color-text-2)',
                    fontWeight: 600,
                  }}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '-'}
                  </td>
                  <td>
                    {improved && <span style={{ color: 'var(--color-success)' }}>▲ Better</span>}
                    {degraded && <span style={{ color: 'var(--color-error)' }}>▼ Worse</span>}
                    {!improved && !degraded && <span style={{ color: 'var(--color-text-2)' }}>-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* Time-Series Overlay */}
      {overlayData.length > 0 && (
        <div className="charts-grid" style={{ marginTop: '1rem' }}>
          <Card>
            <h3 style={{ marginBottom: '0.5rem' }}>Requests/s Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
                <YAxis stroke="var(--color-text-2)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="rpsA" stroke={CHART_COLORS.primary} dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="rpsB" stroke={CHART_COLORS.error} dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ marginBottom: '0.5rem' }}>p95 Response Time Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
                <YAxis stroke="var(--color-text-2)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} formatter={(v) => [`${Number(v).toFixed(0)} ms`]} />
                <Legend />
                <Line type="monotone" dataKey="p95A" stroke={CHART_COLORS.primary} dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="p95B" stroke={CHART_COLORS.error} dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 style={{ marginBottom: '0.5rem' }}>Active Users Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
                <YAxis stroke="var(--color-text-2)" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTime(Number(l))} />
                <Legend />
                <Line type="monotone" dataKey="usersA" stroke={CHART_COLORS.primary} dot={false} name="Test A" connectNulls />
                <Line type="monotone" dataKey="usersB" stroke={CHART_COLORS.error} dot={false} name="Test B" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}
