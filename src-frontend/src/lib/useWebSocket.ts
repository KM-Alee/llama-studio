import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isDesktopRuntime } from '@/lib/platform/env'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import type { ServerLogEntry, ServerStatus } from '@/stores/serverStore'

interface WsMessage {
  type: 'server_status' | 'log'
  status?: string
  model?: string | null
  timestamp?: string
  line?: string
}

/**
 * Browser transport: WebSocket to `/api/v1/ws` (same origin as the standalone backend).
 * Desktop: only Tauri `server://*` and `downloads://progress` — no WebSocket or localhost URL.
 */
export function useWebSocket() {
  const queryClient = useQueryClient()
  const setStatus = useServerStore((s) => s.setStatus)
  const appendLog = useServerStore((s) => s.appendLog)
  const setActiveModel = useModelStore((s) => s.setActiveModel)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (isDesktopRuntime()) {
      let cancelled = false
      const unsubs: (() => void)[] = []

      void (async () => {
        const [a, b, c] = await Promise.all([
          listen<WsMessage>('server://status', (e) => {
            const msg = e.payload
            if (msg.type === 'server_status' && msg.status) {
              setStatus(msg.status as ServerStatus)
              setActiveModel(msg.model ?? null)
            }
          }),
          listen<WsMessage>('server://log', (e) => {
            const msg = e.payload
            if (msg.type === 'log' && msg.timestamp && msg.line) {
              appendLog({
                timestamp: msg.timestamp,
                line: msg.line,
              } satisfies ServerLogEntry)
            }
          }),
          listen<unknown>('downloads://progress', () => {
            void queryClient.invalidateQueries({ queryKey: ['downloads'] })
          }),
        ])
        if (cancelled) {
          a()
          b()
          c()
          return
        }
        unsubs.push(a, b, c)
      })()

      return () => {
        cancelled = true
        for (const f of unsubs) f()
      }
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const connect = () => {
      if (disposed || wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws`)

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          if (msg.type === 'server_status' && msg.status) {
            setStatus(msg.status as ServerStatus)
            setActiveModel(msg.model ?? null)
            return
          }

          if (msg.type === 'log' && msg.timestamp && msg.line) {
            appendLog({
              timestamp: msg.timestamp,
              line: msg.line,
            } satisfies ServerLogEntry)
          }
        } catch {
          // Ignore malformed frames.
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (!disposed) {
          reconnectTimer = setTimeout(() => connect(), 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [appendLog, queryClient, setActiveModel, setStatus])

  const send = useCallback((data: object) => {
    if (isDesktopRuntime()) {
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
