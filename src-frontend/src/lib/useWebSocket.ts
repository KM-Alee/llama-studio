import { useCallback, useEffect, useRef } from 'react'
import { useServerStore } from '@/stores/serverStore'
import type { ServerLogEntry, ServerStatus } from '@/stores/serverStore'
import { useModelStore } from '@/stores/modelStore'

interface WsMessage {
  type: 'server_status' | 'log'
  status?: string
  model?: string | null
  timestamp?: string
  line?: string
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const setStatus = useServerStore((s) => s.setStatus)
  const appendLog = useServerStore((s) => s.appendLog)
  const setActiveModel = useModelStore((s) => s.setActiveModel)

  useEffect(() => {
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
  }, [appendLog, setActiveModel, setStatus])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
