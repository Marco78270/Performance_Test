import React from 'react'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${loading ? 'ui-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="ui-btn__icon">{icon}</span>
      )}
      {children && <span className="ui-btn__label">{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className="ui-btn__icon">{icon}</span>
      )}
    </button>
  )
}
