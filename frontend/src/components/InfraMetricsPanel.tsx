import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { InfraMetricsSnapshot } from '../hooks/useInfraMetricsWebSocket'
import type { ServerType } from '../api/serverApi'

interface InfraMetricsPanelProps {
  metrics: InfraMetricsSnapshot[]
  connected: boolean
}

const SERVER_TYPE_COLORS: Record<ServerType, string> = {
  API: '#3498db',
  SQL: '#9b59b6',
  WEB: '#27ae60',
  FILE: '#e67e22',
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatBytesPerSec(bps: number | null): string {
  if (bps == null) return '-'
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`
}

function formatTime(sec: unknown): string {
  const num = Number(sec)
  if (isNaN(num)) return '0s'
  const m = Math.floor(num / 60)
  const s = Math.floor(num % 60)
  return m > 0 ? `${m}m${s}s` : `${s}s`
}

export default function InfraMetricsPanel({ metrics, connected }: InfraMetricsPanelProps) {
  const servers = useMemo(() => {
    const map = new Map<number, { name: string; type: ServerType }>()
    for (const m of metrics) {
      if (!map.has(m.serverId)) {
        map.set(m.serverId, { name: m.serverName, type: m.serverType })
      }
    }
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }))
  }, [metrics])

  const startTs = metrics[0]?.timestamp || Date.now()

  const chartDataByServer = useMemo(() => {
    const grouped = new Map<number, InfraMetricsSnapshot[]>()
    for (const m of metrics) {
      const arr = grouped.get(m.serverId) || []
      arr.push(m)
      grouped.set(m.serverId, arr)
    }
    return grouped
  }, [metrics])

  const cpuChartData = useMemo(() => {
    const timeMap = new Map<number, Record<string, number | null> & { time: number }>()
    for (const [serverId, serverMetrics] of chartDataByServer) {
      const server = servers.find((s) => s.id === serverId)
      if (!server) continue
      for (const m of serverMetrics) {
        const time = Math.round((m.timestamp - startTs) / 1000)
        const existing = timeMap.get(time) || { time }
        existing[`cpu_${serverId}`] = m.cpuPercent
        timeMap.set(time, existing)
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
  }, [chartDataByServer, servers, startTs])

  const memoryChartData = useMemo(() => {
    const timeMap = new Map<number, Record<string, number | null> & { time: number }>()
    for (const [serverId, serverMetrics] of chartDataByServer) {
      const server = servers.find((s) => s.id === serverId)
      if (!server) continue
      for (const m of serverMetrics) {
        const time = Math.round((m.timestamp - startTs) / 1000)
        const existing = timeMap.get(time) || { time }
        existing[`mem_${serverId}`] = m.memoryPercent
        timeMap.set(time, existing)
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
  }, [chartDataByServer, servers, startTs])

  const diskChartData = useMemo(() => {
    const timeMap = new Map<number, Record<string, number | null> & { time: number }>()
    for (const [serverId, serverMetrics] of chartDataByServer) {
      for (const m of serverMetrics) {
        const time = Math.round((m.timestamp - startTs) / 1000)
        const existing = timeMap.get(time) || { time }
        existing[`diskRead_${serverId}`] = m.diskReadBytesPerSec ? m.diskReadBytesPerSec / (1024 * 1024) : null
        existing[`diskWrite_${serverId}`] = m.diskWriteBytesPerSec ? m.diskWriteBytesPerSec / (1024 * 1024) : null
        timeMap.set(time, existing)
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
  }, [chartDataByServer, startTs])

  const networkChartData = useMemo(() => {
    const timeMap = new Map<number, Record<string, number | null> & { time: number }>()
    for (const [serverId, serverMetrics] of chartDataByServer) {
      for (const m of serverMetrics) {
        const time = Math.round((m.timestamp - startTs) / 1000)
        const existing = timeMap.get(time) || { time }
        existing[`netRecv_${serverId}`] = m.networkRecvBytesPerSec ? m.networkRecvBytesPerSec / (1024 * 1024) : null
        existing[`netSent_${serverId}`] = m.networkSentBytesPerSec ? m.networkSentBytesPerSec / (1024 * 1024) : null
        timeMap.set(time, existing)
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
  }, [chartDataByServer, startTs])

  const lastMetricsByServer = useMemo(() => {
    const map = new Map<number, InfraMetricsSnapshot>()
    for (const m of metrics) {
      map.set(m.serverId, m)
    }
    return map
  }, [metrics])

  const tooltipStyle = { background: '#16213e', border: '1px solid #0f3460' }

  if (servers.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#a0a0b8' }}>
          No infrastructure metrics available. Configure servers in the Servers page to start monitoring.
        </p>
        <span className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`} style={{ marginTop: '0.5rem' }}>
          {connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <span className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
        <span style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>
          Monitoring {servers.length} server{servers.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-row-wrap" style={{ marginBottom: '1rem' }}>
        {servers.map((server) => {
          const last = lastMetricsByServer.get(server.id)
          return (
            <div key={server.id} className="card" style={{ flex: '1 1 200px', minWidth: '200px' }}>
              <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: '#fff' }}>{server.name}</span>
                <span className={`status-badge status-${server.type}`}>{server.type}</span>
              </div>
              {last?.error ? (
                <div style={{ color: '#e94560', fontSize: '0.85rem' }}>{last.error}</div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#a0a0b8' }}>
                  <div>CPU: {last?.cpuPercent != null ? `${last.cpuPercent.toFixed(1)}%` : '-'}</div>
                  <div>Memory: {last?.memoryPercent != null ? `${last.memoryPercent.toFixed(1)}%` : '-'} ({formatBytes(last?.memoryUsedBytes ?? null)} / {formatBytes(last?.memoryTotalBytes ?? null)})</div>
                  <div>Disk R/W: {formatBytesPerSec(last?.diskReadBytesPerSec ?? null)} / {formatBytesPerSec(last?.diskWriteBytesPerSec ?? null)}</div>
                  <div>Net In/Out: {formatBytesPerSec(last?.networkRecvBytesPerSec ?? null)} / {formatBytesPerSec(last?.networkSentBytesPerSec ?? null)}</div>
                  {last?.sqlBatchPerSec != null && <div>SQL Batch/s: {last.sqlBatchPerSec.toFixed(1)}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>CPU Usage (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={cpuChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
              <YAxis stroke="#a0a0b8" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(1)}%`, '']} />
              <Legend />
              {servers.map((server) => (
                <Line
                  key={server.id}
                  type="monotone"
                  dataKey={`cpu_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  dot={false}
                  name={server.name}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Memory Usage (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={memoryChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
              <YAxis stroke="#a0a0b8" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(1)}%`, '']} />
              <Legend />
              {servers.map((server) => (
                <Line
                  key={server.id}
                  type="monotone"
                  dataKey={`mem_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  dot={false}
                  name={server.name}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Disk I/O (MB/s)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={diskChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
              <YAxis stroke="#a0a0b8" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(2)} MB/s`, '']} />
              <Legend />
              {servers.map((server) => (
                <Line
                  key={`read-${server.id}`}
                  type="monotone"
                  dataKey={`diskRead_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  strokeDasharray="5 5"
                  dot={false}
                  name={`${server.name} Read`}
                  connectNulls
                />
              ))}
              {servers.map((server) => (
                <Line
                  key={`write-${server.id}`}
                  type="monotone"
                  dataKey={`diskWrite_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  dot={false}
                  name={`${server.name} Write`}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Network I/O (MB/s)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={networkChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
              <XAxis dataKey="time" stroke="#a0a0b8" tickFormatter={formatTime} />
              <YAxis stroke="#a0a0b8" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(2)} MB/s`, '']} />
              <Legend />
              {servers.map((server) => (
                <Line
                  key={`recv-${server.id}`}
                  type="monotone"
                  dataKey={`netRecv_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  strokeDasharray="5 5"
                  dot={false}
                  name={`${server.name} In`}
                  connectNulls
                />
              ))}
              {servers.map((server) => (
                <Line
                  key={`sent-${server.id}`}
                  type="monotone"
                  dataKey={`netSent_${server.id}`}
                  stroke={SERVER_TYPE_COLORS[server.type]}
                  dot={false}
                  name={`${server.name} Out`}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
