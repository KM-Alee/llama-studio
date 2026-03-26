import { useEffect, useRef, useCallback } from 'react'
import { useServerStore } from '@/stores/serverStore'
import type { ServerStatus } from '@/stores/serverStore'
import { useModelStore } from '@/stores/modelStore'

interface WsMessage {
  type: string
  status?: string
  model?: string | null
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const setStatus = useServerStore((s) => s.setStatus)
  const setActiveModel = useModelStore((s) => s.setActiveModel)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws`)

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        if (msg.type === 'server_status' && msg.status) {
          setStatus(msg.status as ServerStatus)
          if (msg.model) {
            setActiveModel(msg.model)
          }
        }
      } catch {
        // Ignore malformed frames
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      // Reconnect after 3 seconds
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [setStatus, setActiveModel])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
