import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchSeleniumClasses, fetchSeleniumTrends, type SeleniumTrendData } from '../api/seleniumApi'

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

  const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--border-color)' }

  const chartData = data?.points.map((p, i) => ({
    index: i + 1,
    label: p.version || `#${p.testRunId}`,
    meanStepDuration: p.meanStepDuration ?? 0,
    passRate: p.passRate,
    totalIterations: p.totalIterations,
  })) || []

  return (
    <div>
      <h1 className="page-title">Selenium Trends</h1>

      <div className="card" style={{ padding: '0.6rem 1.2rem', marginBottom: '1rem' }}>
        <div className="flex-row">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Script Class:</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {classes.length === 0 && <option>No completed tests</option>}
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Last:</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>10 runs</option>
            <option value={20}>20 runs</option>
            <option value={50}>50 runs</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : !data || data.points.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
          No completed test runs found for this script class.
        </div>
      ) : (
        <>
          <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tests Analyzed</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>{data.points.length}</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg Pass Rate</div>
              <div style={{ fontSize: '1.5rem', color: (data.points.reduce((s, p) => s + p.passRate, 0) / data.points.length) >= 80 ? '#27ae60' : '#e94560' }}>
                {(data.points.reduce((s, p) => s + p.passRate, 0) / data.points.length).toFixed(0)}%
              </div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg Step Duration</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>
                {(data.points.reduce((s, p) => s + (p.meanStepDuration ?? 0), 0) / data.points.length).toFixed(0)} ms
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: '1rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Mean Step Duration (ms)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(0)} ms`, 'Mean Step']} />
                  <Line type="monotone" dataKey="meanStepDuration" stroke="#e67e22" dot={{ r: 3 }} name="Mean Step" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Pass Rate (%)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Pass Rate']} />
                  <Line type="monotone" dataKey="passRate" stroke="#27ae60" dot={{ r: 3 }} name="Pass Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Total Iterations</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Iterations']} />
                  <Line type="monotone" dataKey="totalIterations" stroke="#2980b9" dot={{ r: 3 }} name="Iterations" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Recent Runs</h3>
            <table>
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
                      <span style={{ color: p.passRate >= 80 ? '#27ae60' : '#e94560' }}>
                        {p.passRate.toFixed(1)}%
                      </span>
                    </td>
                    <td>{p.totalIterations.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
