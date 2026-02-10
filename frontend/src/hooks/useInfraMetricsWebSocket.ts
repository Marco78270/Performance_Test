import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { ServerType } from '../api/serverApi'

export interface InfraMetricsSnapshot {
  timestamp: number
  serverId: number
  serverName: string
  serverType: ServerType
  cpuPercent: number | null
  memoryUsedBytes: number | null
  memoryTotalBytes: number | null
  memoryPercent: number | null
  diskReadBytesPerSec: number | null
  diskWriteBytesPerSec: number | null
  networkRecvBytesPerSec: number | null
  networkSentBytesPerSec: number | null
  sqlBatchPerSec: number | null
  error: string | null
}

export function useInfraMetricsWebSocket(testRunId: number | null) {
  const [metrics, setMetrics] = useState<InfraMetricsSnapshot[]>([])
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
        client.subscribe(`/topic/infra-metrics/${testRunId}`, (message) => {
          const snapshot: InfraMetricsSnapshot = JSON.parse(message.body)
          setMetrics((prev) => {
            const next = [...prev, snapshot]
            // Keep last 500 snapshots per server to avoid memory issues
            const grouped = new Map<number, InfraMetricsSnapshot[]>()
            for (const m of next) {
              const arr = grouped.get(m.serverId) || []
              arr.push(m)
              grouped.set(m.serverId, arr)
            }
            const result: InfraMetricsSnapshot[] = []
            for (const arr of grouped.values()) {
              result.push(...arr.slice(-250))
            }
            return result
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
