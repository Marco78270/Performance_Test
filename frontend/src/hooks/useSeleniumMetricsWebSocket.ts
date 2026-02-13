import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { SeleniumMetricsSnapshot } from '../api/seleniumApi'

const MAX_METRICS_POINTS = 600

export function useSeleniumMetricsWebSocket(testRunId: number | null) {
  const [metrics, setMetrics] = useState<SeleniumMetricsSnapshot[]>([])
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)

  const clear = useCallback(() => setMetrics([]), [])

  useEffect(() => {
    if (testRunId == null) return

    setMetrics([])

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/selenium-metrics/${testRunId}`, (message) => {
          const snapshot: SeleniumMetricsSnapshot = JSON.parse(message.body)
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
              const sampled: SeleniumMetricsSnapshot[] = []
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
