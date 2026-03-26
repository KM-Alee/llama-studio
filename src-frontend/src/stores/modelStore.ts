import { create } from 'zustand'

export interface Model {
  id: string
  name: string
  path: string
  sizeBytes: number
  quantization: string | null
  architecture: string | null
  parameters: string | null
  contextLength: number | null
  addedAt: string
  lastUsed: string | null
}

interface ModelState {
  models: Model[]
  activeModelId: string | null
  setModels: (models: Model[]) => void
  setActiveModel: (id: string | null) => void
}

export const useModelStore = create<ModelState>((set) => ({
  models: [],
  activeModelId: null,
  setModels: (models) => set({ models }),
  setActiveModel: (id) => set({ activeModelId: id }),
}))
