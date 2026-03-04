import { useState } from 'react'
import { exportConfig, importConfig, type ConfigExport } from '../api/configApi'
import { Button, Card, PageHeader, Alert } from '../components/ui'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ConfigExport | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ profiles: number; servers: number; settings: number } | null>(null)
  const [error, setError] = useState('')

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const data = await exportConfig()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const a = document.createElement('a')
      a.href = url
      a.download = `gatlingweb-config-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult(null)
    setError('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ConfigExport
      setPreview(parsed)
    } catch {
      setError('Invalid JSON file')
      setPreview(null)
    }
  }

  async function handleImport() {
    if (!preview) return
    if (!confirm('This will replace all threshold profiles, monitored servers, and app settings. Continue?')) return
    setImporting(true)
    setError('')
    try {
      const result = await importConfig(preview)
      setImportResult(result)
      setPreview(null)
      setImportFile(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Settings" breadcrumb="Système / Paramètres" />

      <Card style={{ marginBottom: '1rem' }}>
        <h3>Export Configuration</h3>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', margin: '0.5rem 0 1rem' }}>
          Export all threshold profiles, monitored servers, and app settings as a JSON file.
        </p>
        <Button variant="primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export JSON'}
        </Button>
      </Card>

      <Card>
        <h3>Import Configuration</h3>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', margin: '0.5rem 0 1rem' }}>
          Import a previously exported configuration. <strong>This replaces all existing settings.</strong>
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="import-file-input"
          />
          <Button
            variant="secondary"
            onClick={() => document.getElementById('import-file-input')?.click()}
          >
            {importFile ? importFile.name : 'Choose JSON file'}
          </Button>
        </div>

        {preview && (
          <div style={{ background: 'var(--color-surface-raised)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Preview</div>
            <div style={{ color: 'var(--color-text-2)', fontSize: '0.85rem' }}>
              Exported: {preview.exportedAt}
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-text)' }}>
                <strong>{preview.thresholdProfiles?.length ?? 0}</strong> threshold profiles
              </span>
              <span style={{ color: 'var(--color-text)' }}>
                <strong>{preview.monitoredServers?.length ?? 0}</strong> monitored servers
              </span>
              <span style={{ color: 'var(--color-text)' }}>
                <strong>{preview.appSettings?.length ?? 0}</strong> app settings
              </span>
            </div>
            <Button
              variant="primary"
              style={{ marginTop: '1rem' }}
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Confirm Import'}
            </Button>
          </div>
        )}

        {importResult && (
          <div style={{ background: '#1a3a2a', border: '1px solid #2a5a3a', borderRadius: '6px', padding: '1rem' }}>
            <div style={{ color: '#4ade80', fontWeight: 600 }}>Import successful</div>
            <div style={{ color: 'var(--color-text-2)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Imported {importResult.profiles} profiles, {importResult.servers} servers, {importResult.settings} settings.
            </div>
          </div>
        )}

        {error && (
          <Alert variant="error" style={{ marginTop: '0.5rem' }}>{error}</Alert>
        )}
      </Card>
    </div>
  )
}
