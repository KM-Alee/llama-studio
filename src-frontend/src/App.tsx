import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ChatPage } from '@/pages/ChatPage'
import { ModelsPage } from '@/pages/ModelsPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat/:conversationId?" element={<ChatPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
