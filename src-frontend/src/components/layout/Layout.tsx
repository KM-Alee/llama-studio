import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from '@/components/CommandPalette'
import { useAppStore } from '@/stores/appStore'
import { useWebSocket } from '@/lib/useWebSocket'
import { useTheme } from '@/lib/useTheme'
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts'
import { cn } from '@/lib/utils'

export function Layout() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)

  useWebSocket()
  useTheme()
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-text">
      <Sidebar />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-200',
          sidebarOpen ? 'ml-72' : 'ml-0',
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      {commandPaletteOpen && (
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
    </div>
  )
}
