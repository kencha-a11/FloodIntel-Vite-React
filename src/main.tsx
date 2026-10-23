import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider'
import { QueueProvider } from './context/QueueProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <QueueProvider>
        <App />
      </QueueProvider>
    </AuthProvider>
  </StrictMode>,
)
