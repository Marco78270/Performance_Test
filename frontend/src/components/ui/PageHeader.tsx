import React from 'react'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: string
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__main">
        {breadcrumb && <span className="ui-page-header__breadcrumb">{breadcrumb}</span>}
        <h1 className="ui-page-header__title">{title}</h1>
        {description && <p className="ui-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  )
}
