import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import './Modal.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ui-modal-overlay" onClick={onClose} role="dialog" aria-modal aria-labelledby="modal-title">
      <div className={`ui-modal ui-modal--${size}`} onClick={e => e.stopPropagation()}>
        <div className="ui-modal-header">
          <div>
            <h2 id="modal-title" className="ui-modal-title">{title}</h2>
            {description && <p className="ui-modal-desc">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer" icon={<X size={16} />} />
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
