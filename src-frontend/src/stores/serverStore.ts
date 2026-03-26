import { create } from 'zustand'

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

interface ServerState {
  status: ServerStatus
  setStatus: (status: ServerStatus) => void
}

export const useServerStore = create<ServerState>((set) => ({
  status: 'stopped',
  setStatus: (status) => set({ status }),
}))
