import { useState, useEffect, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

loader.config({ monaco })
import {
  fetchFileTree, fetchFileContent, saveFile, createFile, deleteFile, renameFile, createDirectory,
  type SimulationFile,
} from '../api/simulationApi'
import { fetchTemplates, fetchTemplateContent, type SimulationTemplate } from '../api/templateApi'
import { Button, Modal, Spinner } from '../components/ui'

function FileTree({
  files, selectedPath, onSelect, onRename, onCreateDir,
}: {
  files: SimulationFile[]
  selectedPath: string
  onSelect: (path: string) => void
  onRename: (path: string) => void
  onCreateDir: (parentPath: string) => void
}) {
  return (
    <ul style={{ listStyle: 'none', paddingLeft: '0.8rem' }}>
      {files.map((f) => (
        <li key={f.path}>
          {f.directory ? (
            <details open>
              <summary style={{ cursor: 'pointer', padding: '0.2rem 0', color: 'var(--color-text-2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ flex: 1 }}>{f.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateDir(f.path) }}
                  title="New folder"
                  style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--color-text-2)' }}
                >
                  +
                </button>
              </summary>
              {f.children && (
                <FileTree files={f.children} selectedPath={selectedPath} onSelect={onSelect} onRename={onRename} onCreateDir={onCreateDir} />
              )}
            </details>
          ) : (
            <div
              style={{
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                borderRadius: '3px',
                background: f.path === selectedPath ? 'var(--color-primary-bg)' : 'transparent',
                color: f.path === selectedPath ? 'var(--color-primary)' : 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span style={{ flex: 1 }} onClick={() => onSelect(f.path)}>{f.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRename(f.path) }}
                title="Rename"
                style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', opacity: 0.6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--color-text-2)' }}
              >
                ✏
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function EditorPage() {
  const [files, setFiles] = useState<SimulationFile[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newFileName, setNewFileName] = useState('')
  const [showNewFile, setShowNewFile] = useState(false)
  const [renameModal, setRenameModal] = useState<{ oldPath: string; newPath: string } | null>(null)
  const [newDirModal, setNewDirModal] = useState<{ parentPath: string; name: string } | null>(null)

  // Template modal state
  const [templateModal, setTemplateModal] = useState(false)
  const [templates, setTemplates] = useState<SimulationTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templateFileName, setTemplateFileName] = useState('')
  const [templatePackage, setTemplatePackage] = useState('')
  const [templateBaseUrl, setTemplateBaseUrl] = useState('http://localhost:8080')
  const [templateCreating, setTemplateCreating] = useState(false)

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const tree = await fetchFileTree()
      setFiles(tree)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTree() }, [loadTree])

  async function handleSelect(path: string) {
    if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return
    const c = await fetchFileContent(path)
    setSelectedPath(path)
    setContent(c)
    setDirty(false)
  }

  async function handleSave() {
    if (!selectedPath) return
    setSaving(true)
    await saveFile(selectedPath, content)
    setDirty(false)
    setSaving(false)
  }

  async function handleCreate() {
    if (!newFileName) return
    const path = newFileName.endsWith('.scala') ? newFileName : newFileName + '.scala'
    await createFile(path)
    setShowNewFile(false)
    setNewFileName('')
    await loadTree()
    handleSelect(path)
  }

  async function handleDelete() {
    if (!selectedPath) return
    if (!confirm(`Delete ${selectedPath}?`)) return
    await deleteFile(selectedPath)
    setSelectedPath('')
    setContent('')
    setDirty(false)
    await loadTree()
  }

  async function handleRenameSubmit() {
    if (!renameModal || !renameModal.newPath) return
    await renameFile(renameModal.oldPath, renameModal.newPath)
    setRenameModal(null)
    if (selectedPath === renameModal.oldPath) {
      setSelectedPath(renameModal.newPath)
    }
    await loadTree()
  }

  async function handleCreateDirSubmit() {
    if (!newDirModal || !newDirModal.name) return
    const fullPath = newDirModal.parentPath ? `${newDirModal.parentPath}/${newDirModal.name}` : newDirModal.name
    await createDirectory(fullPath)
    setNewDirModal(null)
    await loadTree()
  }

  async function openTemplateModal() {
    setTemplateModal(true)
    setSelectedTemplate('')
    setTemplateFileName('')
    setTemplatePackage('')
    setTemplateBaseUrl('http://localhost:8080')
    try {
      const list = await fetchTemplates()
      setTemplates(list)
    } catch {
      setTemplates([])
    }
  }

  async function handleTemplateCreate() {
    if (!selectedTemplate || !templateFileName) return
    setTemplateCreating(true)
    try {
      const className = templateFileName.replace(/\.scala$/, '')
      const filePath = templatePackage
        ? `${templatePackage.replace(/\./g, '/')}/${className}.scala`
        : `${className}.scala`
      const templateContent = await fetchTemplateContent(selectedTemplate, className, templatePackage, templateBaseUrl)
      await createFile(filePath, templateContent)
      setTemplateModal(false)
      await loadTree()
      handleSelect(filePath)
    } finally {
      setTemplateCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 3rem)', gap: '1rem' }}>
      <div style={{ width: '250px', overflowY: 'auto', flexShrink: 0 }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--color-text)' }}>Files</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowNewFile(!showNewFile)}>+ New</Button>
          <Button variant="secondary" size="sm" onClick={() => setNewDirModal({ parentPath: '', name: '' })}>+ Dir</Button>
          <Button variant="primary" size="sm" onClick={openTemplateModal}>Template</Button>
        </div>
        {showNewFile && (
          <div style={{ marginBottom: '0.5rem' }}>
            <input type="text" placeholder="path/File.scala" value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              style={{ width: '100%', marginBottom: '0.3rem' }} />
            <Button variant="primary" size="sm" onClick={handleCreate}>Create</Button>
          </div>
        )}
        {loading ? (
          <Spinner />
        ) : (
          <FileTree
            files={files}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onRename={(path) => setRenameModal({ oldPath: path, newPath: path })}
            onCreateDir={(parentPath) => setNewDirModal({ parentPath, name: '' })}
          />
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
          <span style={{ flex: 1, color: 'var(--color-text-2)' }}>
            {selectedPath || 'Select a file'}
            {dirty && ' *'}
          </span>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {selectedPath && (
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          )}
        </div>
        <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
          <Editor
            language="scala"
            theme="vs-dark"
            value={content}
            onChange={(v) => { setContent(v || ''); setDirty(true) }}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              readOnly: !selectedPath,
            }}
          />
        </div>
      </div>

      <Modal
        open={!!renameModal}
        onClose={() => setRenameModal(null)}
        title="Rename file"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleRenameSubmit}>Rename</Button>
          </>
        }
      >
        {renameModal && (
          <input
            type="text"
            value={renameModal.newPath}
            onChange={(e) => setRenameModal({ ...renameModal, newPath: e.target.value })}
            style={{ width: '100%' }}
            autoFocus
          />
        )}
      </Modal>

      <Modal
        open={!!newDirModal}
        onClose={() => setNewDirModal(null)}
        title="Create directory"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewDirModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateDirSubmit}>Create</Button>
          </>
        }
      >
        {newDirModal && (
          <input
            type="text"
            placeholder="Directory name"
            value={newDirModal.name}
            onChange={(e) => setNewDirModal({ ...newDirModal, name: e.target.value })}
            style={{ width: '100%' }}
            autoFocus
          />
        )}
      </Modal>

      <Modal
        open={templateModal}
        onClose={() => setTemplateModal(false)}
        title="New from Template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleTemplateCreate}
              disabled={!selectedTemplate || !templateFileName || templateCreating}>
              {templateCreating ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {templates.map((t) => (
              <div key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                style={{
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: selectedTemplate === t.id ? `2px solid var(--color-primary)` : '1px solid var(--color-border)',
                  background: selectedTemplate === t.id ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.85rem' }}>{t.name}</div>
                <div style={{ color: 'var(--color-text-2)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{t.description}</div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.2rem' }}>File Name</label>
            <input type="text" placeholder="MySimulation.scala" value={templateFileName}
              onChange={(e) => setTemplateFileName(e.target.value)}
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.2rem' }}>Package (optional)</label>
            <input type="text" placeholder="com.example" value={templatePackage}
              onChange={(e) => setTemplatePackage(e.target.value)}
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.2rem' }}>Base URL</label>
            <input type="text" value={templateBaseUrl}
              onChange={(e) => setTemplateBaseUrl(e.target.value)}
              style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
