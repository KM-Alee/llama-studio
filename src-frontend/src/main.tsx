import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { isDesktopRuntime } from './lib/platform/env'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
})

async function bootstrap() {
  if (isDesktopRuntime()) {
    const { bootstrapDesktopUiFromLegacy } = await import('./lib/platform/desktopUiBootstrap')
    await bootstrapDesktopUiFromLegacy()
  }
}

const root = document.getElementById('root')!

const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '2px solid var(--color-border)',
              borderRadius: '0',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              boxShadow: '3px 3px 0 var(--color-border)',
            },
            duration: 4000,
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)

void bootstrap()
  .then(() => {
    createRoot(root).render(app)
  })
  .catch((e) => {
    console.error('[llamastudio] bootstrap failed', e)
    createRoot(root).render(app)
  })
