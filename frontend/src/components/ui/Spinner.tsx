import './Spinner.css'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  label?: string
}

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className={`ui-spinner ui-spinner--${size}`} role="status" aria-label={label ?? 'Chargement...'}>
      <div className="ui-spinner__ring" />
      {label && <span className="ui-spinner__label">{label}</span>}
    </div>
  )
}
