import React from 'react'
import './Badge.css'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', dot = false, children, className = '' }: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Badge de status test (RUNNING, COMPLETED, FAILED, QUEUED, CANCELLED) */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    RUNNING:   'primary',
    COMPLETED: 'success',
    FAILED:    'error',
    QUEUED:    'warning',
    CANCELLED: 'neutral',
  }
  return (
    <Badge variant={map[status] ?? 'neutral'} dot={status === 'RUNNING'}>
      {status}
    </Badge>
  )
}
