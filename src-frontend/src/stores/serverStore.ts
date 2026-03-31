import { create } from 'zustand'

const MAX_LOG_LINES = 2000

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface ServerLogEntry {
  timestamp: string
  line: string
}

interface ServerState {
  status: ServerStatus
  logs: ServerLogEntry[]
  setStatus: (status: ServerStatus) => void
  replaceLogs: (logs: ServerLogEntry[]) => void
  appendLog: (entry: ServerLogEntry) => void
  clearLogs: () => void
}

export const useServerStore = create<ServerState>((set) => ({
  status: 'stopped',
  logs: [],
  setStatus: (status) => set({ status }),
  replaceLogs: (logs) => set({ logs: logs.slice(-MAX_LOG_LINES) }),
  appendLog: (entry) =>
    set((state) => ({
      logs: [...state.logs, entry].slice(-MAX_LOG_LINES),
    })),
  clearLogs: () => set({ logs: [] }),
}))
