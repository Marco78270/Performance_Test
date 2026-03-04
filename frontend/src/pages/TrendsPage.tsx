import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fetchTrends, fetchCompletedSimulationClasses, type TrendData } from '../api/testRunApi'
import { Card, PageHeader, Spinner, Select } from '../components/ui'
import { CHART_COLORS } from '../styles/chartColors'

export default function TrendsPage() {
  const [classes, setClasses] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompletedSimulationClasses().then((c) => {
      setClasses(c)
      if (c.length > 0) setSelected(c[0])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    fetchTrends(selected, limit)
      .then(setData)
      .finally(() => setLoading(false))
  }, [selected, limit])

  const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }

  const chartData = data?.points.map((p, i) => ({
    index: i + 1,
    label: p.version || `#${p.testRunId}`,
    p95: p.p95ResponseTime ?? 0,
    meanRt: p.meanResponseTime ?? 0,
    errorRate: p.errorRate,
    throughput: p.totalRequests ?? 0,
    verdict: p.thresholdVerdict,
  })) || []

  return (
    <div>
      <PageHeader title="Trends" breadcrumb="Gatling / Tendances" />

      <Card style={{ marginBottom: '1rem' }}>
        <div className="flex-row">
          <Select
            label="Simulation"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ minWidth: '240px' }}
          >
            {classes.length === 0 && <option>No completed tests</option>}
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select
            label="Last"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={10}>10 runs</option>
            <option value={20}>20 runs</option>
            <option value={50}>50 runs</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Chargement..." />
      ) : !data || data.points.length === 0 ? (
        <Card style={{ textAlign: 'center', color: 'var(--color-text-2)', padding: '2rem' }}>
          No completed test runs found for this simulation.
        </Card>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
            <div className="ui-kpi">
              <span className="ui-kpi__label">Tests Analyzed</span>
              <div className="ui-kpi__value-row">
                <span className="ui-kpi__value">{data.points.length}</span>
              </div>
            </div>
            <div className={`ui-kpi ${data.thresholdPassRate >= 80 ? 'ui-kpi--success' : 'ui-kpi--error'}`}>
              <span className="ui-kpi__label">Threshold Pass Rate</span>
              <div className="ui-kpi__value-row">
                <span className="ui-kpi__value">{data.thresholdPassRate.toFixed(0)}</span>
                <span className="ui-kpi__unit">%</span>
              </div>
            </div>
            <div className="ui-kpi">
              <span className="ui-kpi__label">Avg p95 RT</span>
              <div className="ui-kpi__value-row">
                <span className="ui-kpi__value">
                  {(data.points.reduce((s, p) => s + (p.p95ResponseTime ?? 0), 0) / data.points.length).toFixed(0)}
                </span>
                <span className="ui-kpi__unit">ms</span>
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: '1rem' }}>
            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>p95 Response Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(0)} ms`, 'p95']} />
                  <Line type="monotone" dataKey="p95" stroke={CHART_COLORS.mean} dot={{ r: 3 }} name="p95 RT" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>Error Rate</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Error Rate']} />
                  <ReferenceLine y={0} stroke="var(--color-border)" />
                  <Line type="monotone" dataKey="errorRate" stroke={CHART_COLORS.eps} dot={{ r: 3 }} name="Error %" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>Throughput (Total Requests)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Requests']} />
                  <Line type="monotone" dataKey="throughput" stroke={CHART_COLORS.rps} dot={{ r: 3 }} name="Total Requests" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <h3 style={{ marginBottom: '0.5rem' }}>Recent Runs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Version</th>
                  <th>Date</th>
                  <th>p95 RT</th>
                  <th>Error Rate</th>
                  <th>Requests</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {[...data.points].reverse().slice(0, 10).map((p) => (
                  <tr key={p.testRunId}>
                    <td>#{p.testRunId}</td>
                    <td>{p.version || '-'}</td>
                    <td>{p.startTime ? new Date(p.startTime).toLocaleString() : '-'}</td>
                    <td>{p.p95ResponseTime != null ? `${p.p95ResponseTime.toFixed(0)} ms` : '-'}</td>
                    <td>{p.errorRate.toFixed(2)}%</td>
                    <td>{p.totalRequests?.toLocaleString() ?? '-'}</td>
                    <td>
                      {p.thresholdVerdict
                        ? <span className={`verdict-badge verdict-${p.thresholdVerdict}`}>{p.thresholdVerdict}</span>
                        : <span style={{ color: 'var(--color-text-2)' }}>-</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
