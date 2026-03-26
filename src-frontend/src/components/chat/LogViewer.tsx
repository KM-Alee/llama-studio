import { useState, useEffect, useRef } from 'react'
import { X, Trash2, ArrowDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getServerLogs } from '@/lib/api'

interface LogViewerProps {
  onClose: () => void
}

interface LogEntry {
  timestamp: string
  line: string
}

export function LogViewer({ onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load initial logs
  const { data } = useQuery({
    queryKey: ['server-logs'],
    queryFn: getServerLogs,
  })

  useEffect(() => {
    if (data?.logs) {
      setLogs(data.logs)
    }
  }, [data])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString()
    } catch {
      return ts
    }
  }

  return (
    <div className="w-96 border-l border-border bg-surface h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Server Logs</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLogs([])}
            className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
              title="Scroll to bottom"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="p-4 text-text-muted text-xs text-center">
            No logs yet. Start the server to see output.
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-2 hover:bg-surface-dim rounded px-1">
                <span className="text-text-muted shrink-0 select-none">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-text break-all whitespace-pre-wrap">
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
