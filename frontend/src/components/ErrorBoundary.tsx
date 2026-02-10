import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="card" style={{ background: '#2d1f1f', borderColor: '#e94560' }}>
          <h3 style={{ color: '#e94560' }}>Something went wrong</h3>
          <p style={{ color: '#a0a0b8', marginTop: '0.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
