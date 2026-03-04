import React from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import './Alert.css'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
  info:    Info,
}

export function Alert({ variant, title, children, style, className = '' }: AlertProps) {
  const Icon = ICONS[variant]
  return (
    <div className={`ui-alert ui-alert--${variant} ${className}`} style={style} role="alert">
      <Icon size={16} className="ui-alert__icon" aria-hidden />
      <div className="ui-alert__body">
        {title && <strong className="ui-alert__title">{title}</strong>}
        <span className="ui-alert__text">{children}</span>
      </div>
    </div>
  )
}
