import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { useAppStore } from '@/stores/appStore'
import { useWebSocket } from '@/lib/useWebSocket'
import { useTheme } from '@/lib/useTheme'
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts'
import { cn } from '@/lib/utils'

export function Layout() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)

  // Establish WebSocket for real-time server status updates
  useWebSocket()

  // Apply theme (dark/light/system) to the document
  useTheme()

  // Register global keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen bg-surface text-text overflow-hidden">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 min-w-0 transition-all duration-200',
          sidebarOpen ? 'ml-72' : 'ml-0'
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
