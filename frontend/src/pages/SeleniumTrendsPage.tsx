import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchSeleniumClasses, fetchSeleniumTrends, type SeleniumTrendData } from '../api/seleniumApi'
import { Card, PageHeader, Spinner, Select } from '../components/ui'
import { CHART_COLORS } from '../styles/chartColors'

export default function SeleniumTrendsPage() {
  const [classes, setClasses] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<SeleniumTrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSeleniumClasses().then((c) => {
      setClasses(c)
      if (c.length > 0) setSelected(c[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    fetchSeleniumTrends(selected, limit)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [selected, limit])

  const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }

  const chartData = data?.points.map((p, i) => ({
    index: i + 1,
    label: p.version || `#${p.testRunId}`,
    meanStepDuration: p.meanStepDuration ?? 0,
    passRate: p.passRate,
    totalIterations: p.totalIterations,
  })) || []

  const avgPassRate = data ? data.points.reduce((s, p) => s + p.passRate, 0) / data.points.length : 0

  return (
    <div>
      <PageHeader title="Selenium Trends" breadcrumb="Selenium / Tendances" />

      <Card style={{ marginBottom: '1rem' }}>
        <div className="flex-row">
          <Select
            label="Script Class"
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
          No completed test runs found for this script class.
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
            <div className={`ui-kpi ${avgPassRate >= 80 ? 'ui-kpi--success' : 'ui-kpi--error'}`}>
              <span className="ui-kpi__label">Avg Pass Rate</span>
              <div className="ui-kpi__value-row">
                <span className="ui-kpi__value">{avgPassRate.toFixed(0)}</span>
                <span className="ui-kpi__unit">%</span>
              </div>
            </div>
            <div className="ui-kpi">
              <span className="ui-kpi__label">Avg Step Duration</span>
              <div className="ui-kpi__value-row">
                <span className="ui-kpi__value">
                  {(data.points.reduce((s, p) => s + (p.meanStepDuration ?? 0), 0) / data.points.length).toFixed(0)}
                </span>
                <span className="ui-kpi__unit">ms</span>
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: '1rem' }}>
            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>Mean Step Duration (ms)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(0)} ms`, 'Mean Step']} />
                  <Line type="monotone" dataKey="meanStepDuration" stroke={CHART_COLORS.mean} dot={{ r: 3 }} name="Mean Step" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>Pass Rate (%)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Pass Rate']} />
                  <Line type="monotone" dataKey="passRate" stroke={CHART_COLORS.success} dot={{ r: 3 }} name="Pass Rate" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ marginBottom: '0.5rem' }}>Total Iterations</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-text-2)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--color-text-2)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Iterations']} />
                  <Line type="monotone" dataKey="totalIterations" stroke={CHART_COLORS.rps} dot={{ r: 3 }} name="Iterations" />
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
                  <th>Mean Step</th>
                  <th>Pass Rate</th>
                  <th>Iterations</th>
                </tr>
              </thead>
              <tbody>
                {[...data.points].reverse().slice(0, 10).map((p) => (
                  <tr key={p.testRunId}>
                    <td>#{p.testRunId}</td>
                    <td>{p.version || '-'}</td>
                    <td>{p.startTime ? new Date(p.startTime).toLocaleString() : '-'}</td>
                    <td>{p.meanStepDuration != null ? `${p.meanStepDuration.toFixed(0)} ms` : '-'}</td>
                    <td>
                      <span style={{ color: p.passRate >= 80 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {p.passRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>{p.totalIterations.toLocaleString()}</td>
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
