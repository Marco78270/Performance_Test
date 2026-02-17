import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fetchTrends, fetchCompletedSimulationClasses, type TrendData } from '../api/testRunApi'

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

  const tooltipStyle = { background: 'var(--tooltip-bg)', border: '1px solid var(--border-color)' }

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
      <h1 className="page-title">Trends</h1>

      <div className="card" style={{ padding: '0.6rem 1.2rem', marginBottom: '1rem' }}>
        <div className="flex-row">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Simulation:</span>
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
          No completed test runs found for this simulation.
        </div>
      ) : (
        <>
          <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tests Analyzed</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>{data.points.length}</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Threshold Pass Rate</div>
              <div style={{ fontSize: '1.5rem', color: data.thresholdPassRate >= 80 ? '#27ae60' : '#e94560' }}>
                {data.thresholdPassRate.toFixed(0)}%
              </div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Avg p95 RT</div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-heading)' }}>
                {(data.points.reduce((s, p) => s + (p.p95ResponseTime ?? 0), 0) / data.points.length).toFixed(0)} ms
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: '1rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>p95 Response Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(0)} ms`, 'p95']} />
                  <Line type="monotone" dataKey="p95" stroke="#e67e22" dot={{ r: 3 }} name="p95 RT" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Error Rate</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Error Rate']} />
                  <ReferenceLine y={0} stroke="var(--border-color)" />
                  <Line type="monotone" dataKey="errorRate" stroke="#e94560" dot={{ r: 3 }} name="Error %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '0.5rem' }}>Throughput (Total Requests)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Requests']} />
                  <Line type="monotone" dataKey="throughput" stroke="#2980b9" dot={{ r: 3 }} name="Total Requests" />
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
                        : <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      }
                    </td>
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
