import { useState, useEffect, useCallback, useRef } from 'react'
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
              {f.name !== 'BaseSeleniumScript.java' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRename(f.path) }}
                  title="Rename"
                  style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', opacity: 0.6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--color-text-2)' }}
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

  // Capture d'écran
  const [capturing, setCapturing] = useState(false)
  const [captureDataUrl, setCaptureDataUrl] = useState<string | null>(null)
  const [captureRegion, setCaptureRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Refs Monaco
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const decorationsRef = useRef<string[]>([])
  const hoverDisposableRef = useRef<monaco.IDisposable | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sikuliDataUrlCache = useRef<Map<string, string>>(new Map())

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

  // Cleanup Monaco hover provider au unmount
  useEffect(() => {
    return () => {
      hoverDisposableRef.current?.dispose()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function updateDecorations(editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) {
    const model = editor.getModel()
    if (!model) return
    const pattern = /"([^"]+\.(?:png|jpg|jpeg))"/gi
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = []
    const lineCount = model.getLineCount()
    for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
      const line = model.getLineContent(lineNum)
      let match: RegExpExecArray | null
      pattern.lastIndex = 0
      while ((match = pattern.exec(line)) !== null) {
        const endCol = match.index + match[0].length + 1
        newDecorations.push({
          range: new monacoInstance.Range(lineNum, endCol, lineNum, endCol),
          options: {
            after: { content: ' 🖼', inlineClassName: 'sikuli-img-hint' },
          },
        })
      }
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }

  function handleEditorMount(editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    // Hover provider pour afficher les images PNG au survol
    // Monaco sanitise les src des <img> → on convertit en data URI base64
    hoverDisposableRef.current?.dispose()
    hoverDisposableRef.current = monacoInstance.languages.registerHoverProvider('java', {
      async provideHover(model, position) {
        const line = model.getLineContent(position.lineNumber)
        const pattern = /"([^"]+\.(?:png|jpg|jpeg))"/gi
        let match: RegExpExecArray | null
        while ((match = pattern.exec(line)) !== null) {
          const startCol = match.index + 2
          const endCol = match.index + match[0].length
          if (position.column >= startCol && position.column <= endCol) {
            const imgName = match[1]

            // Récupérer depuis le cache ou fetcher en base64
            let dataUrl = sikuliDataUrlCache.current.get(imgName)
            if (!dataUrl) {
              try {
                const res = await fetch(getSikuliImageUrl(imgName))
                if (res.ok) {
                  const blob = await res.blob()
                  dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                  })
                  sikuliDataUrlCache.current.set(imgName, dataUrl)
                }
              } catch {
                // image non trouvée, on n'affiche pas
              }
            }

            if (!dataUrl) return null
            return {
              range: new monacoInstance.Range(position.lineNumber, startCol, position.lineNumber, endCol),
              contents: [
                { value: `**${imgName}**` },
                {
                  value: `<img src="${dataUrl}" style="max-height:150px;max-width:250px;border-radius:4px;" />`,
                  isTrusted: true,
                  supportHtml: true,
                },
              ],
            }
          }
        }
        return null
      },
    })

    // Décorations initiales + abonnement aux changements
    updateDecorations(editor, monacoInstance)
    editor.onDidChangeModelContent(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateDecorations(editor, monacoInstance)
      }, 500)
    })
  }

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

  // ── Capture d'écran ──────────────────────────────────────────────
  async function handleCapture() {
    if (!sikuliOpen) {
      setSikuliOpen(true)
      await loadSikuliImages()
    }
    setCapturing(true)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      stream.getTracks().forEach((t) => t.stop())
      captureCanvasRef.current = canvas
      setCaptureDataUrl(canvas.toDataURL('image/png'))
      setCaptureRegion(null)
      setDragStart(null)
    } catch {
      // L'utilisateur a annulé ou refusé la capture
    } finally {
      setCapturing(false)
    }
  }

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    setDragStart({ x: e.clientX, y: e.clientY })
    setCaptureRegion(null)
  }

  function handleOverlayMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart) return
    const x = Math.min(e.clientX, dragStart.x)
    const y = Math.min(e.clientY, dragStart.y)
    const w = Math.abs(e.clientX - dragStart.x)
    const h = Math.abs(e.clientY - dragStart.y)
    setCaptureRegion({ x, y, w, h })
  }

  function handleOverlayMouseUp() {
    setDragStart(null)
  }

  async function handleConfirmCapture() {
    if (!captureRegion || !captureCanvasRef.current) return
    const srcCanvas = captureCanvasRef.current
    const scaleX = srcCanvas.width / window.innerWidth
    const scaleY = srcCanvas.height / window.innerHeight

    const crop = document.createElement('canvas')
    crop.width = Math.round(captureRegion.w * scaleX)
    crop.height = Math.round(captureRegion.h * scaleY)
    const ctx = crop.getContext('2d')!
    ctx.drawImage(
      srcCanvas,
      Math.round(captureRegion.x * scaleX),
      Math.round(captureRegion.y * scaleY),
      crop.width,
      crop.height,
      0, 0, crop.width, crop.height,
    )

    crop.toBlob(async (blob) => {
      if (!blob) return
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const name = `capture_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`
      const file = new File([blob], name, { type: 'image/png' })

      setSikuliUploading(true)
      try {
        await uploadSikuliImage(file)
        await loadSikuliImages()
      } finally {
        setSikuliUploading(false)
      }

      // Insérer le nom au curseur Monaco
      if (editorRef.current && monacoRef.current) {
        const editor = editorRef.current
        const monacoInstance = monacoRef.current
        const pos = editor.getPosition()
        if (pos) {
          editor.executeEdits('capture-insert', [{
            range: new monacoInstance.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: `"${name}"`,
          }])
        }
      }

      setCaptureDataUrl(null)
      setCaptureRegion(null)
    }, 'image/png')
  }

  function handleCancelCapture() {
    setCaptureDataUrl(null)
    setCaptureRegion(null)
    setDragStart(null)
  }

  const isBaseScript = selectedPath === 'BaseSeleniumScript.java'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 3rem)', gap: '1rem' }}>
      <div style={{ width: '250px', overflowY: 'auto', flexShrink: 0 }}>
        <div className="flex-row" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--color-text)' }}>Selenium Scripts</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowNewFile(!showNewFile)}>+ New</Button>
          <Button variant="secondary" size="sm" onClick={() => setNewDirModal({ parentPath: '', name: '' })}>+ Dir</Button>
          <Button variant="primary" size="sm" onClick={openTemplateModal}>Template</Button>
        </div>
        {showNewFile && (
          <div style={{ marginBottom: '0.5rem' }}>
            <input type="text" placeholder="MyScript.java" value={newFileName}
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

        {/* SikuliLite Images Section */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
            <div
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-2)', fontSize: '0.85rem', fontWeight: 600, flex: 1 }}
              onClick={handleSikuliToggle}
            >
              <span style={{ transform: sikuliOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>&#9654;</span>
              SikuliLite Images
            </div>
            <Button variant="secondary" size="sm" onClick={handleCapture} disabled={capturing} title="Capturer une région de l'écran">
              {capturing ? '⏳' : '📷'}
            </Button>
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
                  border: `2px dashed ${sikuliDragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '4px',
                  padding: '0.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: sikuliDragOver ? 'var(--color-primary)' : 'var(--color-text-2)',
                  background: sikuliDragOver ? 'var(--color-primary-bg)' : 'transparent',
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Loading...</div>
              ) : sikuliImages.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No images yet</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {sikuliImages.map((img) => (
                    <li key={img.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0', fontSize: '0.75rem' }}>
                      <img
                        src={getSikuliImageUrl(img.name)}
                        alt={img.name}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '2px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img.name}>
                        {img.name}
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => handleSikuliCopy(img.name)} title="Copy name">CP</Button>
                      <Button variant="danger" size="sm" onClick={() => handleSikuliDelete(img.name)} title="Delete">X</Button>
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
          <span style={{ flex: 1, color: 'var(--color-text-2)' }}>
            {selectedPath || 'Select a file'}
            {dirty && ' *'}
            {isBaseScript && ' (read-only)'}
          </span>
          <Button variant="secondary" size="sm" onClick={handleCompile} disabled={compiling}>
            {compiling ? 'Compiling...' : 'Compile'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving || isBaseScript}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {selectedPath && !isBaseScript && (
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
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

        <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
          <Editor
            language="java"
            theme="vs-dark"
            value={content}
            onChange={(v) => { if (!isBaseScript) { setContent(v || ''); setDirty(true) } }}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              readOnly: !selectedPath || isBaseScript,
            }}
          />
        </div>
      </div>

      {/* Overlay de sélection de région pour la capture */}
      {captureDataUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundImage: `url(${captureDataUrl})`,
            backgroundSize: '100% 100%',
            cursor: 'crosshair',
            userSelect: 'none',
          }}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
        >
          {/* Rectangle de sélection */}
          {captureRegion && captureRegion.w > 2 && captureRegion.h > 2 && (
            <div
              style={{
                position: 'absolute',
                left: captureRegion.x,
                top: captureRegion.y,
                width: captureRegion.w,
                height: captureRegion.h,
                border: '2px solid #e94560',
                background: 'rgba(233, 69, 96, 0.1)',
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}

          {/* Barre de boutons en bas */}
          <div
            style={{
              position: 'absolute',
              bottom: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '1rem',
              background: 'var(--color-surface)',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
              {captureRegion && captureRegion.w > 2
                ? `${Math.round(captureRegion.w)} × ${Math.round(captureRegion.h)} px`
                : 'Dessinez une région'}
            </span>
            <Button variant="primary" size="sm" disabled={!captureRegion || captureRegion.w < 5 || captureRegion.h < 5} onClick={handleConfirmCapture}>
              Confirmer
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCancelCapture}>Annuler</Button>
          </div>
        </div>
      )}

      <Modal open={!!renameModal} onClose={() => setRenameModal(null)} title="Rename file"
        footer={<><Button variant="secondary" onClick={() => setRenameModal(null)}>Cancel</Button><Button variant="primary" onClick={handleRenameSubmit}>Rename</Button></>}
      >
        {renameModal && (
          <input type="text" value={renameModal.newPath}
            onChange={(e) => setRenameModal({ ...renameModal, newPath: e.target.value })}
            style={{ width: '100%' }} autoFocus />
        )}
      </Modal>

      <Modal open={!!newDirModal} onClose={() => setNewDirModal(null)} title="Create directory"
        footer={<><Button variant="secondary" onClick={() => setNewDirModal(null)}>Cancel</Button><Button variant="primary" onClick={handleCreateDirSubmit}>Create</Button></>}
      >
        {newDirModal && (
          <input type="text" placeholder="Directory name" value={newDirModal.name}
            onChange={(e) => setNewDirModal({ ...newDirModal, name: e.target.value })}
            style={{ width: '100%' }} autoFocus />
        )}
      </Modal>

      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title="New Selenium Script from Template" size="lg"
        footer={<><Button variant="secondary" onClick={() => setTemplateModal(false)}>Cancel</Button><Button variant="primary" onClick={handleTemplateCreate} disabled={!selectedTemplate || !templateFileName || templateCreating}>{templateCreating ? 'Creating...' : 'Create'}</Button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {templates.map((t) => (
              <div key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                border: selectedTemplate === t.id ? `2px solid var(--color-primary)` : '1px solid var(--color-border)',
                background: selectedTemplate === t.id ? 'var(--color-primary-bg)' : 'var(--color-surface)',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.85rem' }}>{t.name}</div>
                <div style={{ color: 'var(--color-text-2)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{t.description}</div>
              </div>
            ))}
          </div>
          <div>
            <label style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.2rem' }}>Class Name</label>
            <input type="text" placeholder="MySeleniumScript" value={templateFileName}
              onChange={(e) => setTemplateFileName(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.2rem' }}>Base URL</label>
            <input type="text" value={templateBaseUrl}
              onChange={(e) => setTemplateBaseUrl(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
