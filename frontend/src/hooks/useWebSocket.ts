import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

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

export function useMetricsWebSocket(testRunId: number | null) {
  const [metrics, setMetrics] = useState<MetricsSnapshot[]>([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)

  const clear = useCallback(() => setMetrics([]), [])

  useEffect(() => {
    if (testRunId == null) return

    // Clear previous test data when testRunId changes
    setMetrics([])

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
            if (next.length > MAX_METRICS_POINTS) {
              // Downsample keeping recent data at full resolution
              const keepRecent = Math.floor(MAX_METRICS_POINTS * 0.2)
              const targetOlder = MAX_METRICS_POINTS - keepRecent
              const olderData = next.slice(0, next.length - keepRecent)
              const recentData = next.slice(next.length - keepRecent)
              const step = olderData.length / targetOlder
              const sampled: MetricsSnapshot[] = []
              for (let i = 0; i < targetOlder; i++) {
                sampled.push(olderData[Math.floor(i * step)])
              }
              return [...sampled, ...recentData]
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
