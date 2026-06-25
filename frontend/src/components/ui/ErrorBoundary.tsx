import { Component } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: 30,
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
          fontSize: 13,
          background: 'var(--surface-bg)',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ color: 'var(--text-color)', fontWeight: 600 }}>Something went wrong</div>
          <div>{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}
