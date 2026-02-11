import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { fetchTestMetrics } from '../api/testRunApi'

export interface MetricsSnapshot {
  timestamp: number
  requestsPerSecond: number
  errorsPerSecond: number
  meanResponseTime: number
  p50: number
  p75: number
  p95: number
  p99: number
  activeUsers: number
  totalRequests: number
  totalErrors: number
}

const MAX_METRICS_POINTS = 600

// Downsample keeping recent data at full resolution
function downsampleMetrics(data: MetricsSnapshot[], maxPoints: number): MetricsSnapshot[] {
  if (data.length <= maxPoints) return data
  const keepRecent = Math.floor(maxPoints * 0.2)
  const targetOlder = maxPoints - keepRecent
  const olderData = data.slice(0, data.length - keepRecent)
  const recentData = data.slice(data.length - keepRecent)
  const step = olderData.length / targetOlder
  const sampled: MetricsSnapshot[] = []
  for (let i = 0; i < targetOlder; i++) {
    sampled.push(olderData[Math.floor(i * step)])
  }
  return [...sampled, ...recentData]
}

export function useMetricsWebSocket(testRunId: number | null) {
  const [metrics, setMetrics] = useState<MetricsSnapshot[]>([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)

  const clear = useCallback(() => setMetrics([]), [])

  useEffect(() => {
    if (testRunId == null) return

    let cancelled = false

    // Clear previous test data when testRunId changes
    setMetrics([])

    // Load historical metrics on mount
    fetchTestMetrics(testRunId).then((historical) => {
      if (cancelled) return
      if (historical.length > 0) {
        setMetrics(downsampleMetrics(historical as MetricsSnapshot[], MAX_METRICS_POINTS))
      }
    }).catch(() => {})

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/metrics/${testRunId}`, (message) => {
          const snapshot: MetricsSnapshot = JSON.parse(message.body)
          setMetrics((prev) => {
            // Deduplicate by timestamp
            if (prev.length > 0 && prev[prev.length - 1].timestamp >= snapshot.timestamp) {
              return prev
            }
            const next = [...prev, snapshot]
            // Cap at MAX_METRICS_POINTS
            if (next.length > MAX_METRICS_POINTS) {
              return downsampleMetrics(next, MAX_METRICS_POINTS)
            }
            return next
          })
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client

    return () => {
      cancelled = true
      client.deactivate()
      clientRef.current = null
    }
  }, [testRunId])

  return { metrics, connected, clear }
}

export function useTestStatusWebSocket(
  testRunId: number | null,
  onStatusChange: (status: string) => void,
) {
  useEffect(() => {
    if (testRunId == null) return

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/test-status/${testRunId}`, (message) => {
          onStatusChange(message.body)
        })
      },
    })

    client.activate()
    return () => { client.deactivate() }
  }, [testRunId, onStatusChange])
}

export function useQueueWebSocket() {
  const [queue, setQueue] = useState<unknown[]>([])

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/queue', (message) => {
          setQueue(JSON.parse(message.body))
        })
      },
    })

    client.activate()
    return () => { client.deactivate() }
  }, [])

  return { queue }
}

export function useLogsWebSocket(testRunId: number | null) {
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)

  const clear = useCallback(() => setLogs([]), [])

  useEffect(() => {
    if (testRunId == null) return

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/logs/${testRunId}`, (message) => {
          setLogs((prev) => {
            const next = [...prev, message.body]
            // Keep last 500 lines to avoid memory issues
            return next.length > 500 ? next.slice(-500) : next
          })
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    })

    client.activate()
    return () => { client.deactivate() }
  }, [testRunId])

  return { logs, connected, clear }
}
