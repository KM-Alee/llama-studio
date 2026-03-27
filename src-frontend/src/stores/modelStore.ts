import { create } from 'zustand'
import type { Model } from '@/lib/api'

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
