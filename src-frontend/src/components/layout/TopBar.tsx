import { useQuery } from '@tanstack/react-query'
import { Menu, Monitor, Zap } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useServerStore } from '@/stores/serverStore'
import { getServerStatus } from '@/lib/api'
import { ModelSelector } from './ModelSelector'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export function TopBar() {
  const profile = useAppStore((s) => s.profile)
  const toggleProfile = useAppStore((s) => s.toggleProfile)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const serverStatus = useServerStore((s) => s.status)
  const setStatus = useServerStore((s) => s.setStatus)

  const { data } = useQuery({
    queryKey: ['server-status'],
    queryFn: getServerStatus,
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (data?.status) {
      setStatus(data.status as any)
    }
  }, [data, setStatus])

  const statusColor = {
    stopped: 'bg-text-muted',
    starting: 'bg-warning animate-pulse',
    running: 'bg-success',
    stopping: 'bg-warning animate-pulse',
    error: 'bg-error',
  }[serverStatus]

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-surface shrink-0">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Server Status */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <div className={cn('w-2 h-2 rounded-full', statusColor)} />
          <span className="capitalize">{serverStatus}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Model Selector */}
        <ModelSelector />

        {/* Profile Toggle */}
        <button
          onClick={toggleProfile}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            profile === 'normal'
              ? 'bg-surface-dim text-text-secondary hover:bg-surface-hover'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          {profile === 'normal' ? (
            <>
              <Monitor className="w-3.5 h-3.5" />
              Normal
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Advanced
            </>
          )}
        </button>
      </div>
    </header>
  )
}
