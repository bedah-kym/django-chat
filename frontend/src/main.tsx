import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles/global.css'
import { applyUiPreferences, useUiStore } from './stores/uiStore'

const uiState = useUiStore.getState()
applyUiPreferences({
  theme: uiState.theme,
  locale: uiState.locale,
  direction: uiState.direction,
  density: uiState.density,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
