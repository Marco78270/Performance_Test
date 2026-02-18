import { useState, useEffect, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

loader.config({ monaco })
import {
  fetchSeleniumFileTree, fetchSeleniumFileContent, saveSeleniumFile,
  createSeleniumFile, deleteSeleniumFile, renameSeleniumFile, createSeleniumDirectory,
  fetchSeleniumTemplates, fetchSeleniumTemplateContent, compileSeleniumScripts,
  fetchSikuliImages, uploadSikuliImage, deleteSikuliImage, getSikuliImageUrl,
  type SeleniumTemplate, type SikuliImage,
} from '../api/seleniumApi'
import { type SimulationFile } from '../api/simulationApi'

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
              <summary style={{ cursor: 'pointer', padding: '0.2rem 0', color: '#a0a0b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ flex: 1 }}>{f.name}</span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}
                  onClick={(e) => { e.stopPropagation(); onCreateDir(f.path) }}
                  title="New folder"
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
                background: f.path === selectedPath ? '#0f3460' : 'transparent',
                color: f.path === selectedPath ? '#e94560' : '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span style={{ flex: 1 }} onClick={() => onSelect(f.path)}>{f.name}</span>
              {f.name !== 'BaseSeleniumScript.java' && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', opacity: 0.6 }}
                  onClick={(e) => { e.stopPropagation(); onRename(f.path) }}
                  title="Rename"
                >
                  ✏
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function SeleniumEditorPage() {
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

  // Template modal
  const [templateModal, setTemplateModal] = useState(false)
  const [templates, setTemplates] = useState<SeleniumTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templateFileName, setTemplateFileName] = useState('')
  const [templateBaseUrl, setTemplateBaseUrl] = useState('http://localhost:8080')
  const [templateCreating, setTemplateCreating] = useState(false)

  // Compile
  const [compiling, setCompiling] = useState(false)
  const [compileOutput, setCompileOutput] = useState<{ success: boolean; output: string[] } | null>(null)

  // SikuliLite Images
  const [sikuliOpen, setSikuliOpen] = useState(false)
  const [sikuliImages, setSikuliImages] = useState<SikuliImage[]>([])
  const [sikuliLoading, setSikuliLoading] = useState(false)
  const [sikuliUploading, setSikuliUploading] = useState(false)
  const [sikuliDragOver, setSikuliDragOver] = useState(false)

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const tree = await fetchSeleniumFileTree()
      setFiles(tree)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTree() }, [loadTree])

  async function handleSelect(path: string) {
    if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return
    const c = await fetchSeleniumFileContent(path)
    setSelectedPath(path)
    setContent(c)
    setDirty(false)
  }

  async function handleSave() {
    if (!selectedPath) return
    setSaving(true)
    await saveSeleniumFile(selectedPath, content)
    setDirty(false)
    setSaving(false)
  }

  async function handleCreate() {
    if (!newFileName) return
    const path = newFileName.endsWith('.java') ? newFileName : newFileName + '.java'
    await createSeleniumFile(path)
    setShowNewFile(false)
    setNewFileName('')
    await loadTree()
    handleSelect(path)
  }

  async function handleDelete() {
    if (!selectedPath) return
    if (!confirm(`Delete ${selectedPath}?`)) return
    await deleteSeleniumFile(selectedPath)
    setSelectedPath('')
    setContent('')
    setDirty(false)
    await loadTree()
  }

  async function handleRenameSubmit() {
    if (!renameModal || !renameModal.newPath) return
    await renameSeleniumFile(renameModal.oldPath, renameModal.newPath)
    setRenameModal(null)
    if (selectedPath === renameModal.oldPath) {
      setSelectedPath(renameModal.newPath)
    }
    await loadTree()
  }

  async function handleCreateDirSubmit() {
    if (!newDirModal || !newDirModal.name) return
    const fullPath = newDirModal.parentPath ? `${newDirModal.parentPath}/${newDirModal.name}` : newDirModal.name
    await createSeleniumDirectory(fullPath)
    setNewDirModal(null)
    await loadTree()
  }

  async function openTemplateModal() {
    setTemplateModal(true)
    setSelectedTemplate('')
    setTemplateFileName('')
    setTemplateBaseUrl('http://localhost:8080')
    try {
      const list = await fetchSeleniumTemplates()
      setTemplates(list)
    } catch {
      setTemplates([])
    }
  }

  async function handleTemplateCreate() {
    if (!selectedTemplate || !templateFileName) return
    setTemplateCreating(true)
    try {
      const className = templateFileName.replace(/\.java$/, '')
      const filePath = `${className}.java`
      const templateContent = await fetchSeleniumTemplateContent(selectedTemplate, className, templateBaseUrl)
      await createSeleniumFile(filePath, templateContent)
      setTemplateModal(false)
      await loadTree()
      handleSelect(filePath)
    } finally {
      setTemplateCreating(false)
    }
  }

  async function handleCompile() {
    setCompiling(true)
    setCompileOutput(null)
    try {
      const result = await compileSeleniumScripts()
      setCompileOutput(result)
    } catch (e: unknown) {
      setCompileOutput({ success: false, output: [(e as Error).message] })
    } finally {
      setCompiling(false)
    }
  }

  // SikuliLite handlers
  async function loadSikuliImages() {
    setSikuliLoading(true)
    try {
      const imgs = await fetchSikuliImages()
      setSikuliImages(imgs)
    } catch {
      setSikuliImages([])
    } finally {
      setSikuliLoading(false)
    }
  }

  function handleSikuliToggle() {
    const next = !sikuliOpen
    setSikuliOpen(next)
    if (next) loadSikuliImages()
  }

  async function handleSikuliUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setSikuliUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadSikuliImage(file)
      }
      await loadSikuliImages()
    } finally {
      setSikuliUploading(false)
    }
  }

  async function handleSikuliDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return
    await deleteSikuliImage(name)
    await loadSikuliImages()
  }

  function handleSikuliCopy(name: string) {
    navigator.clipboard.writeText(name)
  }

  const isBaseScript = selectedPath === 'BaseSeleniumScript.java'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 3rem)', gap: '1rem' }}>
      <div style={{ width: '250px', overflowY: 'auto', flexShrink: 0 }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.1rem', color: '#fff' }}>Selenium Scripts</h2>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setShowNewFile(!showNewFile)}>+ New</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setNewDirModal({ parentPath: '', name: '' })}>+ Dir</button>
          <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
            onClick={openTemplateModal}>Template</button>
        </div>
        {showNewFile && (
          <div style={{ marginBottom: '0.5rem' }}>
            <input type="text" placeholder="MyScript.java" value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              style={{ width: '100%', marginBottom: '0.3rem' }} />
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={handleCreate}>
              Create
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <FileTree
            files={files}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onRename={(path) => setRenameModal({ oldPath: path, newPath: path })}
            onCreateDir={(parentPath) => setNewDirModal({ parentPath, name: '' })}
          />
        )}

        {/* SikuliLite Images Section */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid #0f3460', paddingTop: '0.5rem' }}>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#a0a0b8', fontSize: '0.85rem', fontWeight: 600 }}
            onClick={handleSikuliToggle}
          >
            <span style={{ transform: sikuliOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>&#9654;</span>
            SikuliLite Images
          </div>

          {sikuliOpen && (
            <div style={{ marginTop: '0.4rem' }}>
              {/* Drop zone + file picker */}
              <div
                onDragOver={(e) => { e.preventDefault(); setSikuliDragOver(true) }}
                onDragLeave={() => setSikuliDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setSikuliDragOver(false); handleSikuliUpload(e.dataTransfer.files) }}
                onClick={() => document.getElementById('sikuli-file-input')?.click()}
                style={{
                  border: `2px dashed ${sikuliDragOver ? '#e94560' : '#0f3460'}`,
                  borderRadius: '4px',
                  padding: '0.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: sikuliDragOver ? '#e94560' : '#a0a0b8',
                  background: sikuliDragOver ? '#0f346020' : 'transparent',
                  transition: 'all 0.2s',
                  marginBottom: '0.4rem',
                }}
              >
                {sikuliUploading ? 'Uploading...' : 'Drop PNG/JPG or click'}
                <input
                  id="sikuli-file-input"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleSikuliUpload(e.target.files)}
                />
              </div>

              {sikuliLoading ? (
                <div style={{ fontSize: '0.75rem', color: '#a0a0b8' }}>Loading...</div>
              ) : sikuliImages.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#a0a0b8' }}>No images yet</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {sikuliImages.map((img) => (
                    <li key={img.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0', fontSize: '0.75rem' }}>
                      <img
                        src={getSikuliImageUrl(img.name)}
                        alt={img.name}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '2px', border: '1px solid #0f3460', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img.name}>
                        {img.name}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.6rem', padding: '0.1rem 0.25rem' }}
                        onClick={() => handleSikuliCopy(img.name)}
                        title="Copy name"
                      >
                        CP
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: '0.6rem', padding: '0.1rem 0.25rem' }}
                        onClick={() => handleSikuliDelete(img.name)}
                        title="Delete"
                      >
                        X
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
          <span style={{ flex: 1, color: '#a0a0b8' }}>
            {selectedPath || 'Select a file'}
            {dirty && ' *'}
            {isBaseScript && ' (read-only)'}
          </span>
          <button className="btn btn-secondary" onClick={handleCompile} disabled={compiling}>
            {compiling ? 'Compiling...' : 'Compile'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving || isBaseScript}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {selectedPath && !isBaseScript && (
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          )}
        </div>

        {compileOutput && (
          <div style={{
            padding: '0.5rem',
            marginBottom: '0.5rem',
            borderRadius: '4px',
            background: compileOutput.success ? '#1a3a2a' : '#3a1a1a',
            border: `1px solid ${compileOutput.success ? '#2a5a3a' : '#5a2a2a'}`,
            maxHeight: '150px',
            overflowY: 'auto',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
          }}>
            <div style={{ color: compileOutput.success ? '#4ade80' : '#f87171', fontWeight: 600, marginBottom: '0.3rem' }}>
              {compileOutput.success ? 'Compilation successful' : 'Compilation failed'}
            </div>
            {compileOutput.output.slice(-20).map((line, i) => (
              <div key={i} style={{ color: '#d0d0d0' }}>{line}</div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, border: '1px solid #0f3460', borderRadius: '4px', overflow: 'hidden' }}>
          <Editor
            language="java"
            theme="vs-dark"
            value={content}
            onChange={(v) => { if (!isBaseScript) { setContent(v || ''); setDirty(true) } }}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              readOnly: !selectedPath || isBaseScript,
            }}
          />
        </div>
      </div>

      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename file</h3>
            <input
              type="text"
              value={renameModal.newPath}
              onChange={(e) => setRenameModal({ ...renameModal, newPath: e.target.value })}
              style={{ width: '100%', marginTop: '0.5rem' }}
              autoFocus
            />
            <div className="flex-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setRenameModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRenameSubmit}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {newDirModal && (
        <div className="modal-overlay" onClick={() => setNewDirModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create directory</h3>
            <input
              type="text"
              placeholder="Directory name"
              value={newDirModal.name}
              onChange={(e) => setNewDirModal({ ...newDirModal, name: e.target.value })}
              style={{ width: '100%', marginTop: '0.5rem' }}
              autoFocus
            />
            <div className="flex-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setNewDirModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateDirSubmit}>Create</button>
            </div>
          </div>
        </div>
      )}

      {templateModal && (
        <div className="modal-overlay" onClick={() => setTemplateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '450px', maxWidth: '600px' }}>
            <h3>New Selenium Script from Template</h3>

            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {templates.map((t) => (
                  <div key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: selectedTemplate === t.id ? '2px solid #e94560' : '1px solid #0f3460',
                      background: selectedTemplate === t.id ? '#0f346040' : '#1a1a2e',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{t.name}</div>
                    <div style={{ color: '#a0a0b8', fontSize: '0.75rem', marginTop: '0.2rem' }}>{t.description}</div>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ color: '#a0a0b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Class Name</label>
                <input type="text" placeholder="MySeleniumScript" value={templateFileName}
                  onChange={(e) => setTemplateFileName(e.target.value)}
                  style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ color: '#a0a0b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Base URL</label>
                <input type="text" value={templateBaseUrl}
                  onChange={(e) => setTemplateBaseUrl(e.target.value)}
                  style={{ width: '100%' }} />
              </div>
            </div>

            <div className="flex-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setTemplateModal(false)}>Cancel</button>
              <button className="btn btn-primary"
                onClick={handleTemplateCreate}
                disabled={!selectedTemplate || !templateFileName || templateCreating}>
                {templateCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
