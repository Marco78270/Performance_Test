import { useEffect, useState, useCallback } from 'react'
import {
  fetchServers,
  createServer,
  updateServer,
  deleteServer,
  toggleServer,
  type MonitoredServer,
  type CreateServerRequest,
  type ServerType,
} from '../api/serverApi'

const SERVER_TYPES: ServerType[] = ['API', 'SQL', 'WEB', 'FILE']

interface ServerModalProps {
  server: MonitoredServer | null
  onClose: () => void
  onSave: (request: CreateServerRequest) => Promise<void>
}

function ServerModal({ server, onClose, onSave }: ServerModalProps) {
  const [name, setName] = useState(server?.name || '')
  const [url, setUrl] = useState(server?.url || '')
  const [serverType, setServerType] = useState<ServerType>(server?.serverType || 'API')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ name, url, serverType })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{server ? 'Edit Server' : 'Add Server'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', color: '#a0a0b8' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="e.g. API Server 1"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', color: '#a0a0b8' }}>URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="e.g. http://192.168.1.10:9182"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', color: '#a0a0b8' }}>Type</label>
            <select
              value={serverType}
              onChange={(e) => setServerType(e.target.value as ServerType)}
              style={{ width: '100%' }}
            >
              {SERVER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {error && <div style={{ color: '#e94560', marginBottom: '1rem' }}>{error}</div>}
          <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServersPage() {
  const [servers, setServers] = useState<MonitoredServer[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MonitoredServer | null>(null)

  const loadServers = useCallback(async () => {
    try {
      const data = await fetchServers()
      setServers(data)
    } catch (err) {
      console.error('Failed to load servers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  function openCreateModal() {
    setEditingServer(null)
    setModalOpen(true)
  }

  function openEditModal(server: MonitoredServer) {
    setEditingServer(server)
    setModalOpen(true)
  }

  async function handleSave(request: CreateServerRequest) {
    if (editingServer) {
      await updateServer(editingServer.id, request)
    } else {
      await createServer(request)
    }
    await loadServers()
  }

  async function handleToggle(server: MonitoredServer) {
    try {
      await toggleServer(server.id)
      await loadServers()
    } catch (err) {
      console.error('Failed to toggle server:', err)
    }
  }

  async function handleDelete(server: MonitoredServer) {
    if (!confirm(`Delete server "${server.name}"?`)) return
    try {
      await deleteServer(server.id)
      await loadServers()
    } catch (err) {
      console.error('Failed to delete server:', err)
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  if (loading) {
    return <div className="loading-spinner">Loading...</div>
  }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Monitored Servers</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Add Server
        </button>
      </div>

      <div className="card">
        {servers.length === 0 ? (
          <p style={{ color: '#a0a0b8' }}>
            No servers configured. Add a Windows Exporter endpoint to start monitoring infrastructure metrics.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id}>
                  <td>{server.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{server.url}</td>
                  <td>
                    <span className={`status-badge status-${server.serverType}`}>
                      {server.serverType}
                    </span>
                  </td>
                  <td>
                    {server.enabled ? (
                      server.lastError ? (
                        <span style={{ color: '#e94560' }} title={server.lastError}>Error</span>
                      ) : server.lastSeenAt ? (
                        <span style={{ color: '#27ae60' }}>Online</span>
                      ) : (
                        <span style={{ color: '#a0a0b8' }}>Unknown</span>
                      )
                    ) : (
                      <span style={{ color: '#7f8c8d' }}>Disabled</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#a0a0b8' }}>
                    {formatDate(server.lastSeenAt)}
                  </td>
                  <td>
                    <div className="flex-row">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleToggle(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        {server.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEditModal(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <ServerModal
          server={editingServer}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
