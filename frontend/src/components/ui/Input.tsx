import React from 'react'
import './Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  icon?: React.ReactNode
}

export function Input({ label, helperText, error, icon, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`ui-input-wrap ${error ? 'ui-input-wrap--error' : ''} ${className}`}>
      {label && <label className="ui-input-label" htmlFor={inputId}>{label}</label>}
      <div className="ui-input-field">
        {icon && <span className="ui-input-icon">{icon}</span>}
        <input id={inputId} className={`ui-input ${icon ? 'ui-input--with-icon' : ''}`} {...props} />
      </div>
      {error && <span className="ui-input-error" role="alert">{error}</span>}
      {!error && helperText && <span className="ui-input-helper">{helperText}</span>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  children: React.ReactNode
}

export function Select({ label, helperText, error, id, children, className = '', ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`ui-input-wrap ${error ? 'ui-input-wrap--error' : ''} ${className}`}>
      {label && <label className="ui-input-label" htmlFor={selectId}>{label}</label>}
      <div className="ui-select-field">
        <select id={selectId} className="ui-select" {...props}>{children}</select>
        <span className="ui-select-arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      {error && <span className="ui-input-error" role="alert">{error}</span>}
      {!error && helperText && <span className="ui-input-helper">{helperText}</span>}
    </div>
  )
}
