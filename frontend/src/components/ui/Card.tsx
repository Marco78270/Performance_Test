import React from 'react'
import './Card.css'

interface CardProps {
  variant?: 'default' | 'elevated' | 'flat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Card({ variant = 'default', padding = 'md', className = '', style, children }: CardProps) {
  return (
    <div className={`ui-card ui-card--${variant} ui-card--pad-${padding} ${className}`} style={style}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="ui-card-header">
      <div className="ui-card-header__text">
        <h3 className="ui-card-header__title">{title}</h3>
        {description && <p className="ui-card-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-card-header__actions">{actions}</div>}
    </div>
  )
}
