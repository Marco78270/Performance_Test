import { useEffect, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { SeleniumBrowserResult } from '../api/seleniumApi'

function resultKey(r: SeleniumBrowserResult): string {
  return `${r.browserIndex}-${r.iteration ?? 0}`
}

export function useSeleniumWebSocket(testRunId: number | null) {
  const [results, setResults] = useState<SeleniumBrowserResult[]>([])
  const [connected, setConnected] = useState(false)

  const clear = useCallback(() => setResults([]), [])

  useEffect(() => {
    if (testRunId == null) return

    setResults([])

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe(`/topic/selenium/${testRunId}`, (message) => {
          const result: SeleniumBrowserResult = JSON.parse(message.body)
          setResults((prev) => {
            const key = resultKey(result)
            const existing = prev.findIndex(r => resultKey(r) === key)
            if (existing >= 0) {
              const next = [...prev]
              next[existing] = result
              return next
            }
            return [...prev, result].sort((a, b) => {
              if (a.browserIndex !== b.browserIndex) return a.browserIndex - b.browserIndex
              return (a.iteration ?? 0) - (b.iteration ?? 0)
            })
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

  return { results, connected, clear }
}

export function useSeleniumScreenWebSocket(testRunId: number | null) {
  const [screenshots, setScreenshots] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (testRunId == null) return

    setScreenshots(new Map())

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/selenium/screen/${testRunId}`, (message) => {
          try {
            const data = JSON.parse(message.body)
            setScreenshots((prev) => {
              const next = new Map(prev)
              next.set(data.bi, data.img)
              return next
            })
          } catch { /* ignore parse errors */ }
        })
      },
    })

    client.activate()
    return () => { client.deactivate() }
  }, [testRunId])

  return screenshots
}

export function useSeleniumStatusWebSocket(
  testRunId: number | null,
  onStatusChange: (status: string) => void,
) {
  useEffect(() => {
    if (testRunId == null) return

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/selenium-status/${testRunId}`, (message) => {
          onStatusChange(message.body)
        })
      },
    })

    client.activate()
    return () => { client.deactivate() }
  }, [testRunId, onStatusChange])
}
