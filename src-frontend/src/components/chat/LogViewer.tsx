import { useEffect, useRef, useState } from 'react'
import { X, Trash2, ArrowDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getServerLogs } from '@/lib/api'
import { useServerStore } from '@/stores/serverStore'

interface LogViewerProps {
  onClose: () => void
}

export function LogViewer({ onClose }: LogViewerProps) {
  const logs = useServerStore((s) => s.logs)
  const replaceLogs = useServerStore((s) => s.replaceLogs)
  const clearLogs = useServerStore((s) => s.clearLogs)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useQuery({
    queryKey: ['server-logs'],
    queryFn: async () => {
      const data = await getServerLogs()
      if (useServerStore.getState().logs.length === 0 && data.logs.length > 0) {
        replaceLogs(data.logs)
      }
      return data
    },
    staleTime: 60_000,
  })

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [autoScroll, logs])

  const handleScroll = () => {
    const element = containerRef.current
    if (!element) return

    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40
    setAutoScroll(atBottom)
  }

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  return (
    <div className="flex h-full w-96 flex-col border-l-2 border-border bg-surface">
      <div className="flex items-center justify-between border-b-2 border-border p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">Server Logs</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={clearLogs}
            className="p-1.5 text-text-muted transition-colors hover:bg-surface-dim"
            title="Clear logs"
            aria-label="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="p-1.5 text-text-muted transition-colors hover:bg-surface-dim"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted transition-colors hover:bg-surface-dim"
            aria-label="Close logs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted font-mono">
            No logs yet. Start the server to see output.
          </div>
        ) : (
          <div className="space-y-0.5 p-3">
            {logs.map((entry) => (
              <div
                key={`${entry.timestamp}-${entry.line}`}
                className="flex gap-2.5 px-2 py-0.5 hover:bg-surface-dim"
              >
                <span className="shrink-0 select-none text-text-muted">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="break-all whitespace-pre-wrap text-text">
                  {entry.line}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
