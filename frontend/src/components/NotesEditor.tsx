import { useState, useRef, useEffect } from 'react'

interface NotesEditorProps {
  notes: string | null
  onSave: (notes: string) => Promise<void>
}

export default function NotesEditor({ notes, onSave }: NotesEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editing])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div
        onClick={() => { setValue(notes || ''); setEditing(true) }}
        style={{
          padding: '0.5rem 0.8rem',
          background: 'var(--input-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: notes ? 'var(--text-primary)' : 'var(--text-muted)',
          minHeight: '2rem',
          whiteSpace: 'pre-wrap',
        }}
      >
        {notes || 'Click to add notes...'}
      </div>
    )
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false) }
          if (e.key === 'Enter' && e.ctrlKey) { handleSave() }
        }}
        rows={3}
        style={{
          width: '100%',
          padding: '0.5rem 0.8rem',
          background: 'var(--input-bg)',
          border: '1px solid var(--accent)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
        placeholder="Add notes about this test..."
      />
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
        <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save (Ctrl+Enter)'}
        </button>
        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
