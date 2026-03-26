import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronDown, HardDrive, Loader2 } from 'lucide-react'
import { getModels, startServer, stopServer } from '@/lib/api'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { formatBytes, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function ModelSelector() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeModelId = useModelStore((s) => s.activeModelId)
  const models = useModelStore((s) => s.models)
  const setModels = useModelStore((s) => s.setModels)
  const setActiveModel = useModelStore((s) => s.setActiveModel)
  const serverStatus = useServerStore((s) => s.status)

  const { data } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const result = await getModels()
      setModels(result.models)
      return result
    },
  })

  const startMutation = useMutation({
    mutationFn: (modelId: string) => startServer(modelId),
    onSuccess: () => toast.success('Model loading...'),
    onError: () => toast.error('Failed to start model'),
  })

  const stopMutation = useMutation({
    mutationFn: stopServer,
    onSuccess: () => {
      setActiveModel(null)
      toast.success('Model unloaded')
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeModel = models.find((m) => m.id === activeModelId)
  const modelList = data?.models ?? models
  const isLoading = serverStatus === 'starting' || serverStatus === 'stopping'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-dim border border-border text-sm hover:bg-surface-hover transition-colors max-w-[220px]"
      >
        <HardDrive className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span className="truncate text-text-secondary">
          {activeModel ? activeModel.name : 'No model'}
        </span>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-surface border border-border rounded-lg shadow-md z-50 overflow-hidden">
          {modelList.length === 0 ? (
            <div className="p-4 text-sm text-text-muted text-center">
              No models available. Scan for models on the Models page.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {modelList.map((model: any) => {
                const isActive = model.id === activeModelId
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (isActive) {
                        stopMutation.mutate()
                      } else {
                        if (serverStatus === 'running') {
                          stopMutation.mutate()
                          setTimeout(() => {
                            setActiveModel(model.id)
                            startMutation.mutate(model.id)
                          }, 500)
                        } else {
                          setActiveModel(model.id)
                          startMutation.mutate(model.id)
                        }
                      }
                      setOpen(false)
                    }}
                    disabled={isLoading}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-surface-hover text-text-secondary'
                    )}
                  >
                    <HardDrive className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{model.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {formatBytes(model.size_bytes)}
                        {model.quantization && ` · ${model.quantization}`}
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-xs font-medium text-primary">Active</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
