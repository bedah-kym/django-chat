import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { applyUiPreferences, useUiStore } from './stores/uiStore'

const uiState = useUiStore.getState()
applyUiPreferences({
  theme: 'dark',
  locale: uiState.locale || 'en',
  direction: uiState.direction || 'ltr',
  density: uiState.density || 'comfortable',
})

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 30, color: '#EF4444', fontFamily: 'monospace', background: '#0D1117', minHeight: '100vh' }}>
          <h2 style={{ color: '#F59E0B' }}>React Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}{'\n\n'}{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter basename="/static/spa">
      <App />
    </BrowserRouter>
  </ErrorBoundary>,
)
