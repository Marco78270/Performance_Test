import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  fetchSeleniumTest, fetchSeleniumResults, fetchSeleniumMetrics, fetchSeleniumInfraMetrics, cancelSeleniumTest, updateSeleniumTestNotes,
  type SeleniumTestRun, type SeleniumBrowserResult, type StepResult, type SeleniumMetricsSnapshot,
} from '../api/seleniumApi'
import { useSeleniumWebSocket, useSeleniumScreenWebSocket, useSeleniumStatusWebSocket } from '../hooks/useSeleniumWebSocket'
import { useSeleniumMetricsWebSocket } from '../hooks/useSeleniumMetricsWebSocket'
import { useInfraMetricsWebSocket, type InfraMetricsSnapshot } from '../hooks/useInfraMetricsWebSocket'
import InfraMetricsPanel from '../components/InfraMetricsPanel'
import NotesEditor from '../components/NotesEditor'
import { Button, Card, KpiCard, PageHeader, Spinner, StatusBadge } from '../components/ui'
import { CHART_COLORS } from '../styles/chartColors'
import { Square } from 'lucide-react'

function parseSteps(stepsJson: string | null): StepResult[] {
  if (!stepsJson) return []
  try { return JSON.parse(stepsJson) } catch { return [] }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(sec: unknown): string {
  const num = Number(sec)
  if (isNaN(num)) return '0s'
  const m = Math.floor(num / 60)
  const s = Math.floor(num % 60)
  return m > 0 ? `${m}m${s}s` : `${s}s`
}

// Smoothing (moving average)
function smoothMetrics(data: SeleniumMetricsSnapshot[], windowSize = 3): SeleniumMetricsSnapshot[] {
  if (data.length < windowSize) return data
  return data.map((point, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const w = data.slice(start, i + 1)
    const len = w.length
    return {
      ...point,
      iterationsPerSecond: w.reduce((s, p) => s + (p.iterationsPerSecond || 0), 0) / len,
      errorsPerSecond: w.reduce((s, p) => s + (p.errorsPerSecond || 0), 0) / len,
      meanStepDuration: w.reduce((s, p) => s + (p.meanStepDuration || 0), 0) / len,
      activeBrowsers: Math.round(w.reduce((s, p) => s + (p.activeBrowsers || 0), 0) / len),
    }
  })
}

interface ChartPoint {
  time: number
  iterationsPerSecond: number
  errorsPerSecond: number
  meanStepDuration: number
  activeBrowsers: number
  cpuPercent: number
  memoryPercent: number
}

function downsample(data: ChartPoint[], maxPoints = 300): ChartPoint[] {
  if (data.length <= maxPoints) return data
  const bucketSize = Math.ceil(data.length / maxPoints)
  const result: ChartPoint[] = []
  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, Math.min(i + bucketSize, data.length))
    const len = bucket.length
    result.push({
      time: bucket[Math.floor(len / 2)].time,
      iterationsPerSecond: bucket.reduce((s, p) => s + p.iterationsPerSecond, 0) / len,
      errorsPerSecond: bucket.reduce((s, p) => s + p.errorsPerSecond, 0) / len,
      meanStepDuration: bucket.reduce((s, p) => s + p.meanStepDuration, 0) / len,
      activeBrowsers: Math.round(bucket.reduce((s, p) => s + p.activeBrowsers, 0) / len),
      cpuPercent: bucket.reduce((s, p) => s + p.cpuPercent, 0) / len,
      memoryPercent: bucket.reduce((s, p) => s + p.memoryPercent, 0) / len,
    })
  }
  return result
}

const ZOOM_LEVELS = [1, 2, 3, 4]

function ScreenshotLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = ZOOM_LEVELS[zoomIndex]
  const isZoomed = zoom > 1

  function cycleZoom() {
    setZoomIndex(i => (i + 1) % ZOOM_LEVELS.length)
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) { if (isZoomed) { setZoomIndex(0) } else { onClose() } } }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.9)', zIndex: 9999,
        overflow: isZoomed ? 'auto' : 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Toolbar */}
      <div style={{
        position: 'fixed', top: '10px', right: '10px', zIndex: 10000,
        display: 'flex', gap: '0.5rem', alignItems: 'center',
      }}>
        {ZOOM_LEVELS.map((level, i) => (
          <button
            key={level}
            onClick={(e) => { e.stopPropagation(); setZoomIndex(i) }}
            style={{
              background: i === zoomIndex ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)',
              border: i === zoomIndex ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.25)',
              color: '#fff', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer',
              fontSize: '0.8rem', backdropFilter: 'blur(4px)', fontWeight: i === zoomIndex ? 700 : 400,
            }}
          >
            {level === 1 ? 'Fit' : `x${level}`}
          </button>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer',
            fontSize: '0.8rem', backdropFilter: 'blur(4px)', marginLeft: '0.3rem',
          }}
        >
          Fermer
        </button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minWidth: isZoomed ? 'fit-content' : undefined,
        minHeight: isZoomed ? 'fit-content' : undefined,
        padding: isZoomed ? '50px 20px 20px' : 0,
      }}>
        <img
          src={src}
          alt="Screenshot"
          onClick={(e) => { e.stopPropagation(); cycleZoom() }}
          style={{
            maxWidth: zoom === 1 ? '95vw' : undefined,
            maxHeight: zoom === 1 ? '95vh' : undefined,
            width: zoom > 1 ? `${zoom * 100}%` : undefined,
            borderRadius: zoom === 1 ? '8px' : 0,
            imageRendering: zoom > 1 ? 'pixelated' : 'auto',
            cursor: zoomIndex < ZOOM_LEVELS.length - 1 ? 'zoom-in' : 'zoom-out',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}

function BrowserCard({ result, screenshot, showIteration }: {
  result: SeleniumBrowserResult; screenshot?: string; showIteration: boolean
}) {
  const steps = parseSteps(result.stepsJson)
  const isRunning = result.status === 'RUNNING'
  const isPassed = result.status === 'PASSED'
  const isFailed = result.status === 'FAILED' || result.status === 'ERROR'

  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      border: `1px solid ${isPassed ? '#2a5a3a' : isFailed ? '#5a2a2a' : '#0f3460'}`,
      borderRadius: '8px',
      padding: '1rem',
      background: isPassed ? '#1a3a2a10' : isFailed ? '#3a1a1a10' : '#1a1a2e',
    }}>
      <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
          Browser #{result.browserIndex + 1}
          {showIteration && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> - Iter {result.iteration + 1}</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isRunning && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px',
              borderRadius: '3px', letterSpacing: '0.5px',
            }}>
              <span style={{ fontSize: '0.5rem' }}>●</span> REC
            </span>
          )}
          <span style={{
            fontSize: '0.85rem',
            padding: '0.1rem 0.5rem',
            borderRadius: '4px',
            background: isPassed ? '#166534' : isFailed ? '#991b1b' : isRunning ? '#854d0e' : '#1e3a5f',
            color: 'var(--text-heading)',
          }}>
            {isRunning && '... '}{result.status}
          </span>
        </div>
      </div>

      {/* Screenshot monitor - masqué après le test si une vidéo est disponible */}
      {screenshot && (isRunning || !result.videoPath) && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            marginBottom: '0.5rem',
            borderRadius: '6px',
            overflow: 'hidden',
            border: `2px solid ${isRunning ? '#3b82f6' : isPassed ? '#166534' : isFailed ? '#991b1b' : '#333'}`,
            background: '#000',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <img
            src={screenshot}
            alt={`Browser #${result.browserIndex + 1}`}
            style={{ width: '100%', display: 'block', imageRendering: 'auto' }}
          />
          {isRunning && (
            <div style={{
              position: 'absolute', top: '4px', right: '6px',
              background: '#ef4444', color: 'var(--text-heading)', fontSize: '0.6rem',
              fontWeight: 700, padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.5px',
            }}>
              LIVE
            </div>
          )}
        </div>
      )}

      {/* Expanded screenshot lightbox */}
      {expanded && screenshot && (isRunning || !result.videoPath) && (
        <ScreenshotLightbox src={screenshot} onClose={() => setExpanded(false)} />
      )}

      {/* Video player — affiché après le test si une vidéo est disponible */}
      {!isRunning && result.videoPath && (
        <video
          src={`/api/selenium/tests/${result.testRunId}/videos/${result.browserIndex}`}
          controls
          style={{ width: '100%', maxHeight: '270px', borderRadius: '4px', marginBottom: '0.5rem', display: 'block' }}
        />
      )}

      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
        Duration: {formatDuration(result.durationMs)}
      </div>

      {result.errorMessage && (
        <div style={{
          padding: '0.4rem', borderRadius: '4px', background: '#3a1a1a',
          color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem', wordBreak: 'break-all',
        }}>
          {result.errorMessage}
        </div>
      )}

      {steps.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.3rem' }}>Steps:</div>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.2rem 0', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{ color: step.passed ? '#4ade80' : '#f87171' }}>
                {step.passed ? '\u2713' : '\u2717'}
              </span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{step.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(step.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IterationRow({ r }: { r: SeleniumBrowserResult }) {
  const steps = parseSteps(r.stepsJson)
  const isPassed = r.status === 'PASSED'
  const isFailed = r.status === 'FAILED' || r.status === 'ERROR'
  const isRunning = r.status === 'RUNNING'
  return (
    <div style={{
      padding: '0.5rem', borderRadius: '6px',
      border: `1px solid ${isPassed ? '#2a5a3a' : isFailed ? '#5a2a2a' : '#0f3460'}`,
      background: isPassed ? '#1a3a2a20' : isFailed ? '#3a1a1a20' : '#16213e',
    }}>
      <div className="flex-row" style={{ marginBottom: steps.length > 0 || r.errorMessage ? '0.3rem' : 0 }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
          Iteration {r.iteration + 1}
        </span>
        <span style={{
          fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px',
          background: isPassed ? '#166534' : isFailed ? '#991b1b' : isRunning ? '#854d0e' : '#1e3a5f',
          color: 'var(--text-heading)',
        }}>
          {r.status}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          {formatDuration(r.durationMs)}
        </span>
      </div>
      {r.errorMessage && (
        <div style={{
          color: '#f87171', fontSize: '0.75rem', padding: '0.2rem',
          background: '#3a1a1a', borderRadius: '3px', wordBreak: 'break-all',
        }}>
          {r.errorMessage}
        </div>
      )}
      {steps.length > 0 && (
        <div style={{ marginTop: '0.3rem' }}>
          {steps.map((step, si) => (
            <div key={si} style={{
              display: 'flex', gap: '0.3rem', fontSize: '0.75rem', padding: '0.1rem 0',
            }}>
              <span style={{ color: step.passed ? '#4ade80' : '#f87171' }}>
                {step.passed ? '\u2713' : '\u2717'}
              </span>
              <span style={{ flex: 1, color: 'var(--text-primary)' }}>{step.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(step.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BrowserIterationsCard({ browserIndex, browserResults, screenshot, isLive }: {
  browserIndex: number
  browserResults: SeleniumBrowserResult[]
  screenshot?: string
  isLive?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const completed = browserResults.filter(r => r.status !== 'RUNNING')
  const running = browserResults.find(r => r.status === 'RUNNING')
  const lastCompleted = completed.length > 0 ? completed[completed.length - 1] : null
  const latestToShow = running || lastCompleted
  const passedCount = completed.filter(r => r.status === 'PASSED').length
  const failedCount = completed.filter(r => r.status === 'FAILED' || r.status === 'ERROR').length
  // Iterations to show collapsed (all completed except the last one if no running)
  const collapsedResults = running ? completed : completed.slice(0, -1)
  // Vidéo disponible sur l'iteration=0 une fois le test terminé
  const videoResult = !isLive ? browserResults.find(r => r.iteration === 0) : undefined
  const hasVideo = videoResult?.videoPath != null

  return (
    <div style={{
      border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-primary)',
    }}>
      {/* Browser header */}
      <div className="flex-row" style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '1rem' }}>
          Browser #{browserIndex + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {completed.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#4ade80' }}>{passedCount}</span>
              {failedCount > 0 && <> / <span style={{ color: '#f87171' }}>{failedCount}</span></>}
              {' '}/ {browserResults.length} iter
            </span>
          )}
          {isLive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px',
              borderRadius: '3px', letterSpacing: '0.5px',
            }}>
              <span style={{ fontSize: '0.5rem' }}>●</span> REC
            </span>
          )}
          {isLive && screenshot && (
            <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>LIVE</span>
          )}
        </div>
      </div>

      {/* Screenshot */}
      {screenshot && isLive && (
        <div style={{
          marginBottom: '0.75rem', borderRadius: '6px', overflow: 'hidden',
          border: '2px solid #3b82f6', background: '#000',
        }}>
          <img src={screenshot} alt={`Browser #${browserIndex + 1}`}
            style={{ width: '100%', display: 'block' }} />
        </div>
      )}

      {/* Video player — affiché après le test si une vidéo est disponible */}
      {hasVideo && videoResult && (
        <video
          src={`/api/selenium/tests/${videoResult.testRunId}/videos/${videoResult.browserIndex}`}
          controls
          style={{ width: '100%', maxHeight: '270px', borderRadius: '4px', marginBottom: '0.75rem', display: 'block' }}
        />
      )}

      {/* Collapsed completed iterations summary */}
      {collapsedResults.length > 0 && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '0.4rem 0.6rem', borderRadius: '6px', marginBottom: '0.5rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.8rem', color: 'var(--text-secondary)', userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{expanded ? '\u25BC' : '\u25B6'}</span>
          <span>
            {collapsedResults.length} iteration{collapsedResults.length > 1 ? 's' : ''} terminée{collapsedResults.length > 1 ? 's' : ''}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            {collapsedResults.filter(r => r.status === 'PASSED').length > 0 && (
              <span style={{ color: '#4ade80' }}>{collapsedResults.filter(r => r.status === 'PASSED').length} {'\u2713'}</span>
            )}
            {collapsedResults.filter(r => r.status === 'FAILED' || r.status === 'ERROR').length > 0 && (
              <span style={{ color: '#f87171' }}>{collapsedResults.filter(r => r.status === 'FAILED' || r.status === 'ERROR').length} {'\u2717'}</span>
            )}
          </span>
        </div>
      )}

      {/* Expanded: show all completed iterations */}
      {expanded && collapsedResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {collapsedResults.map((r) => (
            <IterationRow key={`${r.browserIndex}-${r.iteration}`} r={r} />
          ))}
        </div>
      )}

      {/* Latest iteration (running or last completed) - always visible */}
      {latestToShow && (
        <IterationRow r={latestToShow} />
      )}
    </div>
  )
}

export default function SeleniumMonitorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const testRunId = id ? Number(id) : null
  const [testRun, setTestRun] = useState<SeleniumTestRun | null>(null)
  const [historicalResults, setHistoricalResults] = useState<SeleniumBrowserResult[]>([])
  const [historicalMetrics, setHistoricalMetrics] = useState<SeleniumMetricsSnapshot[]>([])
  const [historicalInfra, setHistoricalInfra] = useState<InfraMetricsSnapshot[]>([])
  const { results: liveResults } = useSeleniumWebSocket(testRunId)
  const screenshots = useSeleniumScreenWebSocket(testRunId)
  const { metrics: liveMetrics } = useSeleniumMetricsWebSocket(testRunId)
  const { metrics: liveInfraMetrics, connected: infraConnected } = useInfraMetricsWebSocket(testRunId)

  const onStatusChange = useCallback(() => {
    if (testRunId) {
      fetchSeleniumTest(testRunId).then(setTestRun).catch(() => {})
      fetchSeleniumResults(testRunId).then(setHistoricalResults).catch(() => {})
      fetchSeleniumMetrics(testRunId).then(setHistoricalMetrics).catch(() => {})
      fetchSeleniumInfraMetrics(testRunId).then(data => setHistoricalInfra(data as InfraMetricsSnapshot[])).catch(() => {})
    }
  }, [testRunId])

  useSeleniumStatusWebSocket(testRunId, onStatusChange)

  useEffect(() => {
    if (testRunId) {
      fetchSeleniumTest(testRunId).then(t => {
        setTestRun(t)
        if (t.status !== 'QUEUED') {
          fetchSeleniumMetrics(testRunId).then(setHistoricalMetrics).catch(() => {})
          fetchSeleniumInfraMetrics(testRunId).then(data => setHistoricalInfra(data as InfraMetricsSnapshot[])).catch(() => {})
        }
      }).catch(() => {})
      fetchSeleniumResults(testRunId).then(setHistoricalResults).catch(() => {})
    }
  }, [testRunId])

  // Merge live and historical results using composite key (browserIndex, iteration)
  const results = useMemo(() => {
    if (testRun?.status === 'RUNNING') {
      if (historicalResults.length === 0) return liveResults
      if (liveResults.length === 0) return historicalResults
      const merged = new Map<string, SeleniumBrowserResult>()
      historicalResults.forEach(r => merged.set(`${r.browserIndex}-${r.iteration ?? 0}`, r))
      liveResults.forEach(r => merged.set(`${r.browserIndex}-${r.iteration ?? 0}`, r))
      return Array.from(merged.values()).sort((a, b) => {
        if (a.browserIndex !== b.browserIndex) return a.browserIndex - b.browserIndex
        return (a.iteration ?? 0) - (b.iteration ?? 0)
      })
    }
    return historicalResults.length > 0 ? historicalResults : liveResults
  }, [testRun?.status, historicalResults, liveResults])

  // Merge historical + live metrics
  const metrics = useMemo(() => {
    if (testRun?.status === 'RUNNING') {
      if (historicalMetrics.length === 0) return liveMetrics
      if (liveMetrics.length === 0) return historicalMetrics
      const lastHistTs = historicalMetrics[historicalMetrics.length - 1].timestamp
      const newLive = liveMetrics.filter(m => m.timestamp > lastHistTs)
      return [...historicalMetrics, ...newLive]
    }
    return historicalMetrics.length > 0 ? historicalMetrics : liveMetrics
  }, [testRun?.status, historicalMetrics, liveMetrics])

  // Merge historical + live infra metrics
  const infraMetrics = useMemo(() => {
    if (testRun?.status === 'RUNNING') {
      if (historicalInfra.length === 0) return liveInfraMetrics
      if (liveInfraMetrics.length === 0) return historicalInfra
      const lastHistTs = historicalInfra[historicalInfra.length - 1].timestamp
      const newLive = liveInfraMetrics.filter(m => m.timestamp > lastHistTs)
      return [...historicalInfra, ...newLive]
    }
    return historicalInfra.length > 0 ? historicalInfra : liveInfraMetrics
  }, [testRun?.status, historicalInfra, liveInfraMetrics])

  const smoothedMetrics = useMemo(() => smoothMetrics(metrics, 3), [metrics])
  const startTs = metrics[0]?.timestamp ?? 0

  const chartData = useMemo(() => {
    const mapped = smoothedMetrics.map((m) => ({
      time: Math.round((m.timestamp - startTs) / 1000),
      iterationsPerSecond: m.iterationsPerSecond || 0,
      errorsPerSecond: m.errorsPerSecond || 0,
      meanStepDuration: m.meanStepDuration || 0,
      activeBrowsers: m.activeBrowsers || 0,
      cpuPercent: m.cpuPercent ?? 0,
      memoryPercent: m.memoryPercent ?? 0,
    }))
    return downsample(mapped, 300)
  }, [smoothedMetrics, startTs])

  // Group results by browser for display
  const resultsByBrowser = useMemo(() => {
    const map = new Map<number, SeleniumBrowserResult[]>()
    results.forEach(r => {
      const list = map.get(r.browserIndex) || []
      list.push(r)
      map.set(r.browserIndex, list)
    })
    return map
  }, [results])

  // Find latest result per browser (for screenshot mapping)
  const latestPerBrowser = useMemo(() => {
    const map = new Map<number, SeleniumBrowserResult>()
    results.forEach(r => {
      const existing = map.get(r.browserIndex)
      if (!existing || (r.iteration ?? 0) >= (existing.iteration ?? 0)) {
        map.set(r.browserIndex, r)
      }
    })
    return map
  }, [results])

  if (!testRun) {
    return <Spinner label="Chargement..." />
  }

  const isActive = testRun.status === 'RUNNING' || testRun.status === 'QUEUED'
  const hasLoops = testRun.loops > 1
  const totalExpected = hasLoops ? testRun.totalIterations : testRun.totalInstances

  // Progress: count completed iterations (or instances if loops=1)
  const completedIterations = results.filter(r => r.status !== 'RUNNING').length
  const progressPercent = totalExpected > 0
    ? Math.round((completedIterations / totalExpected) * 100)
    : 0

  const last = metrics[metrics.length - 1]
  const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }

  async function handleCancel() {
    if (testRunId && confirm('Cancel this test?')) {
      await cancelSeleniumTest(testRunId)
    }
  }

  const description = [
    testRun.browser,
    `${testRun.instances} instance(s)`,
    hasLoops ? `${testRun.loops} loops` : null,
    testRun.rampUpSeconds > 0 ? `ramp-up ${testRun.rampUpSeconds}s` : null,
    testRun.version ? `v${testRun.version}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader
        title={testRun.scriptClass}
        breadcrumb="Selenium / Monitor"
        description={description}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <StatusBadge status={testRun.status} />
            {isActive && (
              <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={handleCancel}>Cancel</Button>
            )}
            {!isActive && (
              <a href={`/api/selenium/tests/${testRun.id}/export/pdf`} className="ui-btn ui-btn--secondary ui-btn--sm">Download PDF</a>
            )}
            {!isActive && (
              <Button variant="secondary" size="sm" onClick={() => {
                const q = new URLSearchParams()
                q.set('scriptClass', testRun.scriptClass)
                q.set('browser', testRun.browser)
                q.set('instances', String(testRun.instances))
                q.set('loops', String(testRun.loops))
                if (testRun.rampUpSeconds > 0) q.set('rampUpSeconds', String(testRun.rampUpSeconds))
                if (testRun.headless) q.set('headless', '1')
                navigate(`/selenium?${q}`)
              }}>Replay</Button>
            )}
          </div>
        }
      />

      {/* Progress bar */}
      <Card style={{ marginBottom: '1rem' }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--color-text-2)' }}>Progress</span>
          <span style={{ color: 'var(--color-text)' }}>
            {completedIterations} / {totalExpected} ({progressPercent}%)
            {hasLoops && ' iterations'}
          </span>
        </div>
        <div style={{
          height: '8px', background: 'var(--color-surface-raised)', borderRadius: '4px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: testRun.status === 'COMPLETED' && testRun.failedInstances === 0
              ? 'var(--color-success)' : testRun.failedInstances > 0 || testRun.failedIterations > 0 ? 'var(--color-error)' : 'var(--color-primary)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        {testRun.status !== 'QUEUED' && testRun.status !== 'RUNNING' && (
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
            {hasLoops ? (
              <>
                <span style={{ color: 'var(--color-success)' }}>Passed Iterations: {testRun.passedIterations}</span>
                <span style={{ color: 'var(--color-error)' }}>Failed Iterations: {testRun.failedIterations}</span>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--color-success)' }}>Passed: {testRun.passedInstances}</span>
                <span style={{ color: 'var(--color-error)' }}>Failed: {testRun.failedInstances}</span>
              </>
            )}
            <span style={{ color: 'var(--color-text-2)' }}>
              Duration: {testRun.startTime && testRun.endTime
                ? formatDuration(testRun.endTime - testRun.startTime)
                : '-'}
            </span>
          </div>
        )}
      </Card>

      {/* Notes */}
      <div style={{ marginBottom: '1rem' }}>
        <NotesEditor
          notes={testRun.notes}
          onSave={async (notes) => {
            if (testRunId) {
              await updateSeleniumTestNotes(testRunId, notes)
              setTestRun(prev => prev ? { ...prev, notes } : prev)
            }
          }}
        />
      </div>

      {/* Summary KPIs */}
      {last && (
        <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
          <KpiCard label="Total Iterations" value={last.totalIterations ?? 0} />
          <KpiCard label="Mean Step Duration" value={(last.meanStepDuration ?? 0).toFixed(0)} unit="ms" />
          <KpiCard label="Active Browsers" value={last.activeBrowsers ?? 0} />
          <KpiCard label="Errors" value={last.totalErrors ?? 0} variant={(last.totalErrors ?? 0) > 0 ? 'danger' : 'default'} />
        </div>
      )}

      {/* Section: Browsers */}
      <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1rem 0 0.5rem' }}>Browsers</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '1rem',
      }}>
        {hasLoops ? (
          // Multi-loop: group by browser, show only latest iteration expanded
          Array.from(resultsByBrowser.entries())
            .sort(([a], [b]) => a - b)
            .map(([browserIndex, browserResults]) => (
              <BrowserIterationsCard
                key={browserIndex}
                browserIndex={browserIndex}
                browserResults={browserResults}
                screenshot={screenshots.get(browserIndex)}
                isLive={latestPerBrowser.get(browserIndex)?.status === 'RUNNING'}
              />
            ))
        ) : (
          // Single loop: original BrowserCard layout
          results.map((r) => (
            <BrowserCard key={r.browserIndex} result={r}
              screenshot={screenshots.get(r.browserIndex)} showIteration={false} />
          ))
        )}

        {/* Placeholders for browsers not yet started */}
        {isActive && (
          (() => {
            const startedBrowsers = new Set(results.map(r => r.browserIndex))
            const placeholders = []
            for (let i = 0; i < testRun.instances; i++) {
              if (!startedBrowsers.has(i)) {
                placeholders.push(
                  <div key={`placeholder-${i}`} style={{
                    border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)', minHeight: '100px',
                  }}>
                    Browser #{i + 1} - Waiting...
                  </div>
                )
              }
            }
            return placeholders
          })()
        )}
      </div>

      {/* Section: Metriques */}
      <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 0.5rem' }}>Metriques</div>
      <div className="charts-grid">
        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Iterations/s</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [(Number(value) || 0).toFixed(2), 'iter/s']} />
              <Line type="monotone" dataKey="iterationsPerSecond" stroke={CHART_COLORS.rps} dot={false} name="iter/s" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Mean Step Duration</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value) || 0).toFixed(0)} ms`, 'Duration']} />
              <Line type="monotone" dataKey="meanStepDuration" stroke={CHART_COLORS.mean} dot={false} name="Mean Step (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Active Browsers</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value) || 0, 'browsers']} />
              <Line type="monotone" dataKey="activeBrowsers" stroke={CHART_COLORS.users} dot={false} name="browsers" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '0.5rem' }}>Errors/s</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" stroke="var(--color-text-2)" tickFormatter={formatTime} />
              <YAxis stroke="var(--color-text-2)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [(Number(value) || 0).toFixed(2), 'err/s']} />
              <Line type="monotone" dataKey="errorsPerSecond" stroke={CHART_COLORS.eps} dot={false} name="err/s" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Section: Infrastructure */}
      <div style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 0.5rem' }}>Infrastructure</div>
      <InfraMetricsPanel metrics={infraMetrics} connected={infraConnected} />
    </div>
  )
}
