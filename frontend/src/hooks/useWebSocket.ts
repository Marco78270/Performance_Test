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

export function useMetricsWebSocket(testRunId: number | null) {
  const [metrics, setMetrics] = useState<MetricsSnapshot[]>([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)

  const clear = useCallback(() => setMetrics([]), [])

  useEffect(() => {
    if (testRunId == null) return

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/metrics/${testRunId}`, (message) => {
          const snapshot: MetricsSnapshot = JSON.parse(message.body)
          setMetrics((prev) => [...prev, snapshot])
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
