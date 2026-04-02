import { Routes, Route, Link } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { ModelAnalyticsPage } from '@/pages/ModelAnalyticsPage'
import { ModelsPage } from '@/pages/ModelsPage'
import { SettingsPage } from '@/pages/SettingsPage'

function NotFoundPage() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm border-2 border-border bg-surface-dim px-8 py-10 text-center">
        <div className="mb-3 font-mono text-4xl font-black text-text-muted/30">404</div>
        <h1 className="text-lg font-bold text-text">Page not found</h1>
        <p className="mt-2 text-sm text-text-muted">
          That route does not exist. Head back to chat.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/chat"
            className="border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Chat
          </Link>
          <Link
            to="/models"
            className="border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            Models
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat/:conversationId?" element={<ChatPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/models/analytics/:modelId?" element={<ModelAnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
