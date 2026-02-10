import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTestRuns, updateTestVersion, updateTestLabels, deleteTestRun, cancelQueuedTest, fetchAllLabels, exportCsv, exportJson, type TestRun, type Page } from '../api/testRunApi'

type SortField = 'startTime' | 'simulationClass' | 'status' | 'totalRequests' | 'meanResponseTime'
type SortDir = 'asc' | 'desc'
type StatusFilter = '' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RUNNING' | 'QUEUED'

const LABEL_COLORS = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e74c3c', '#2ecc71', '#34495e']

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getLabelColor(label: string): string {
  return LABEL_COLORS[hashString(label) % LABEL_COLORS.length]
}

export default function HistoryPage() {
  const [page, setPage] = useState<Page<TestRun> | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageNum, setPageNum] = useState(0)
  const [sortBy, setSortBy] = useState<SortField>('startTime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editingVersion, setEditingVersion] = useState<{ id: number; value: string } | null>(null)
  const [filterLabel, setFilterLabel] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [addingLabel, setAddingLabel] = useState<{ id: number; value: string } | null>(null)
  const [compareSelection, setCompareSelection] = useState<number[]>([])
  const [allLabels, setAllLabels] = useState<string[]>([])
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false)
  const [showAddLabelSuggestions, setShowAddLabelSuggestions] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAllLabels().then(setAllLabels).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchTestRuns({ page: pageNum, size: 15, sortBy, sortDir, label: filterLabel || undefined })
      .then(setPage)
      .finally(() => setLoading(false))
  }, [pageNum, sortBy, sortDir, filterLabel])

  // Client-side status filter
  const filteredContent = page?.content.filter(run => {
    if (filterStatus && run.status !== filterStatus) return false
    return true
  }) ?? []

  async function handleVersionSave(id: number) {
    if (!editingVersion) return
    await updateTestVersion(id, editingVersion.value)
    setPage((prev) => prev ? {
      ...prev,
      content: prev.content.map((r) => r.id === id ? { ...r, version: editingVersion.value } : r)
    } : null)
    setEditingVersion(null)
  }

  async function handleDelete(id: number) {
    if (!confirm(`Delete test #${id}?`)) return
    await deleteTestRun(id)
    setPage((prev) => prev ? {
      ...prev,
      content: prev.content.filter((r) => r.id !== id),
      totalElements: prev.totalElements - 1,
    } : null)
  }

  async function handleAddLabel(id: number) {
    if (!addingLabel || !addingLabel.value.trim()) return
    const run = page?.content.find(r => r.id === id)
    if (!run) return
    const newLabels = [...(run.labels || []), addingLabel.value.trim()]
    await updateTestLabels(id, newLabels)
    setPage((prev) => prev ? {
      ...prev,
      content: prev.content.map((r) => r.id === id ? { ...r, labels: newLabels } : r)
    } : null)
    setAddingLabel(null)
    setShowAddLabelSuggestions(false)
    // Refresh labels list
    if (!allLabels.includes(addingLabel.value.trim())) {
      setAllLabels(prev => [...prev, addingLabel.value.trim()].sort())
    }
  }

  async function handleRemoveLabel(id: number, label: string) {
    const run = page?.content.find(r => r.id === id)
    if (!run) return
    const newLabels = (run.labels || []).filter(l => l !== label)
    await updateTestLabels(id, newLabels)
    setPage((prev) => prev ? {
      ...prev,
      content: prev.content.map((r) => r.id === id ? { ...r, labels: newLabels } : r)
    } : null)
  }

  function toggleCompare(id: number) {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPageNum(0)
  }

  function formatDuration(run: TestRun): string {
    if (!run.startTime || !run.endTime) return '-'
    const ms = new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ${sec % 60}s`
    const hr = Math.floor(min / 60)
    return `${hr}h ${min % 60}m`
  }

  const labelFilterSuggestions = allLabels.filter(l =>
    l.toLowerCase().includes(filterLabel.toLowerCase()) && l !== filterLabel
  )

  const addLabelSuggestions = addingLabel
    ? allLabels.filter(l =>
        l.toLowerCase().includes(addingLabel.value.toLowerCase()) &&
        !(page?.content.find(r => r.id === addingLabel.id)?.labels || []).includes(l)
      )
    : []

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {children} {sortBy === field && (sortDir === 'asc' ? '▲' : '▼')}
    </th>
  )

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Test History</h1>
        {compareSelection.length === 2 && (
          <button className="btn btn-primary"
            onClick={() => navigate(`/compare?ids=${compareSelection[0]},${compareSelection[1]}`)}>
            Compare ({compareSelection.length})
          </button>
        )}
        {compareSelection.length === 1 && (
          <span style={{ color: '#a0a0b8', fontSize: '0.85rem' }}>Select 1 more to compare</span>
        )}
        {compareSelection.length > 0 && (
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setCompareSelection([])}>Clear</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
            onClick={() => exportCsv()}>Export CSV</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
            onClick={() => exportJson()}>Export JSON</button>
        </div>
      </div>

      <div className="card" style={{ padding: '0.6rem 1.2rem', marginBottom: '0.5rem' }}>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ color: '#a0a0b8', fontSize: '0.85rem', marginRight: '0.5rem' }}>Label:</span>
            <input
              type="text"
              placeholder="Filter by label..."
              value={filterLabel}
              onChange={(e) => { setFilterLabel(e.target.value); setPageNum(0); setShowLabelSuggestions(true) }}
              onFocus={() => setShowLabelSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLabelSuggestions(false), 200)}
              style={{ width: '180px' }}
            />
            {showLabelSuggestions && labelFilterSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 10,
                background: '#16213e', border: '1px solid #0f3460', borderRadius: '4px',
                maxHeight: '150px', overflowY: 'auto', width: '200px', marginTop: '2px'
              }}>
                {labelFilterSuggestions.map(l => (
                  <div key={l}
                    style={{ padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: '#e0e0e0' }}
                    onMouseDown={() => { setFilterLabel(l); setPageNum(0); setShowLabelSuggestions(false) }}
                  >{l}</div>
                ))}
              </div>
            )}
            {filterLabel && (
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', marginLeft: '0.3rem' }}
                onClick={() => setFilterLabel('')}>Clear</button>
            )}
          </div>
          <div>
            <span style={{ color: '#a0a0b8', fontSize: '0.85rem', marginRight: '0.5rem' }}>Status:</span>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as StatusFilter) }}
              style={{ fontSize: '0.85rem' }}>
              <option value="">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
              <option value="QUEUED">Queued</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <SortHeader field="simulationClass">Simulation</SortHeader>
                  <th>Version</th>
                  <th>Labels</th>
                  <SortHeader field="startTime">Date</SortHeader>
                  <th>Duration</th>
                  <SortHeader field="status">Status</SortHeader>
                  <th>Verdict</th>
                  <SortHeader field="totalRequests">Requests</SortHeader>
                  <th>Errors</th>
                  <SortHeader field="meanResponseTime">Mean RT</SortHeader>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContent.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={compareSelection.includes(run.id)}
                        onChange={() => toggleCompare(run.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>{run.simulationClass}</td>
                    <td>
                      {editingVersion?.id === run.id ? (
                        <div className="flex-row">
                          <input type="text" value={editingVersion.value}
                            onChange={(e) => setEditingVersion({ ...editingVersion, value: e.target.value })}
                            style={{ width: '80px' }} />
                          <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                            onClick={() => handleVersionSave(run.id)}>OK</button>
                        </div>
                      ) : (
                        <span onClick={() => setEditingVersion({ id: run.id, value: run.version || '' })}
                          style={{ cursor: 'pointer', borderBottom: '1px dashed #a0a0b8' }}>
                          {run.version || '-'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center' }}>
                        {(run.labels || []).map((label) => (
                          <span key={label} className="label-badge"
                            style={{ borderColor: getLabelColor(label), color: getLabelColor(label) }}
                            onClick={() => setFilterLabel(label)}
                            title={`Filter by "${label}"`}>
                            {label}
                            <span
                              style={{ marginLeft: '0.3rem', cursor: 'pointer', opacity: 0.7 }}
                              onClick={(e) => { e.stopPropagation(); handleRemoveLabel(run.id, label) }}
                              title="Remove label"
                            >&times;</span>
                          </span>
                        ))}
                        {addingLabel?.id === run.id ? (
                          <div style={{ position: 'relative' }}>
                            <div className="flex-row" style={{ gap: '0.2rem' }}>
                              <input type="text" value={addingLabel.value}
                                onChange={(e) => { setAddingLabel({ ...addingLabel, value: e.target.value }); setShowAddLabelSuggestions(true) }}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddLabel(run.id)}
                                onFocus={() => setShowAddLabelSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAddLabelSuggestions(false), 200)}
                                style={{ width: '80px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
                                autoFocus />
                              <button className="btn btn-primary"
                                style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}
                                onClick={() => handleAddLabel(run.id)}>+</button>
                              <button className="btn btn-secondary"
                                style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}
                                onClick={() => { setAddingLabel(null); setShowAddLabelSuggestions(false) }}>&times;</button>
                            </div>
                            {showAddLabelSuggestions && addLabelSuggestions.length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 10,
                                background: '#16213e', border: '1px solid #0f3460', borderRadius: '4px',
                                maxHeight: '120px', overflowY: 'auto', width: '140px', marginTop: '2px'
                              }}>
                                {addLabelSuggestions.slice(0, 8).map(l => (
                                  <div key={l}
                                    style={{ padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.75rem', color: '#e0e0e0' }}
                                    onMouseDown={() => {
                                      setAddingLabel({ ...addingLabel!, value: l })
                                      setShowAddLabelSuggestions(false)
                                    }}
                                  >{l}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{ cursor: 'pointer', color: '#a0a0b8', fontSize: '0.75rem' }}
                            onClick={() => setAddingLabel({ id: run.id, value: '' })}
                            title="Add label"
                          >+</span>
                        )}
                      </div>
                    </td>
                    <td>{run.startTime ? new Date(run.startTime).toLocaleString() : '-'}</td>
                    <td>{formatDuration(run)}</td>
                    <td><span className={`status-badge status-${run.status}`}>{run.status}</span></td>
                    <td>
                      {run.thresholdVerdict
                        ? <span className={`verdict-badge verdict-${run.thresholdVerdict}`}>{run.thresholdVerdict}</span>
                        : <span style={{ color: '#a0a0b8' }}>-</span>}
                    </td>
                    <td>{run.totalRequests ?? '-'}</td>
                    <td>{run.totalErrors ?? '-'}</td>
                    <td>{run.meanResponseTime != null ? `${run.meanResponseTime.toFixed(0)} ms` : '-'}</td>
                    <td>
                      <div className="flex-row">
                        {run.status === 'RUNNING' && (
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => navigate(`/test/${run.id}`)}>Live</button>
                        )}
                        {run.status === 'QUEUED' && (
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', color: '#f39c12' }}
                            onClick={async () => {
                              await cancelQueuedTest(run.id)
                              setPage((prev) => prev ? {
                                ...prev,
                                content: prev.content.map((r) => r.id === run.id ? { ...r, status: 'CANCELLED' as const } : r)
                              } : null)
                            }}>Cancel</button>
                        )}
                        {run.reportPath && (
                          <a href={`/reports/${run.reportPath}/index.html`} target="_blank"
                            className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                            rel="noreferrer">Report</a>
                        )}
                        {run.status !== 'RUNNING' && run.status !== 'QUEUED' && (
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', color: '#e94560' }}
                            onClick={() => handleDelete(run.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredContent.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: '#a0a0b8' }}>No test runs found</td></tr>
                )}
              </tbody>
            </table>

            {page && page.totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                <button className="btn btn-secondary" disabled={page.first}
                  onClick={() => setPageNum(0)} style={{ padding: '0.3rem 0.6rem' }}>First</button>
                <button className="btn btn-secondary" disabled={page.first}
                  onClick={() => setPageNum((p) => p - 1)} style={{ padding: '0.3rem 0.6rem' }}>Prev</button>
                <span style={{ color: '#a0a0b8' }}>
                  Page {page.number + 1} of {page.totalPages} ({page.totalElements} total)
                </span>
                <button className="btn btn-secondary" disabled={page.last}
                  onClick={() => setPageNum((p) => p + 1)} style={{ padding: '0.3rem 0.6rem' }}>Next</button>
                <button className="btn btn-secondary" disabled={page.last}
                  onClick={() => setPageNum(page.totalPages - 1)} style={{ padding: '0.3rem 0.6rem' }}>Last</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
