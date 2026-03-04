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
import { Button, Card, PageHeader, Spinner, Modal, Alert } from '../components/ui'

const SERVER_TYPES: ServerType[] = ['API', 'SQL', 'WEB', 'FILE']

interface ServerModalProps {
  open: boolean
  server: MonitoredServer | null
  onClose: () => void
  onSave: (request: CreateServerRequest) => Promise<void>
}

function ServerModal({ open, server, onClose, onSave }: ServerModalProps) {
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

  const footer = (
    <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
      <Button variant="secondary" type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={saving} onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={server ? 'Edit Server' : 'Add Server'}
      footer={footer}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-2)' }}>Name</label>
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
          <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-2)' }}>URL</label>
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
          <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-2)' }}>Type</label>
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
        {error && <Alert variant="error" style={{ marginBottom: '1rem' }}>{error}</Alert>}
      </form>
    </Modal>
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
    return <Spinner />
  }

  return (
    <div>
      <PageHeader
        title="Monitored Servers"
        breadcrumb="Système / Serveurs"
        actions={
          <Button variant="primary" onClick={openCreateModal}>
            Add Server
          </Button>
        }
      />

      <Card>
        {servers.length === 0 ? (
          <p style={{ color: 'var(--color-text-2)' }}>
            No servers configured. Add a Windows Exporter endpoint to start monitoring infrastructure metrics.
          </p>
        ) : (
          <table className="data-table">
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
                        <span style={{ color: 'var(--color-text-2)' }}>Unknown</span>
                      )
                    ) : (
                      <span style={{ color: '#7f8c8d' }}>Disabled</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--color-text-2)' }}>
                    {formatDate(server.lastSeenAt)}
                  </td>
                  <td>
                    <div className="flex-row">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggle(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        {server.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(server)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ServerModal
        open={modalOpen}
        server={editingServer}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
