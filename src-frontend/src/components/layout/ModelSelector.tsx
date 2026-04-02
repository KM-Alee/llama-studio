import { useEffect, useRef, useState } from 'react'
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
    queryFn: getModels,
  })

  useEffect(() => {
    if (data?.models) {
      setModels(data.models)
    }
  }, [data, setModels])

  const startMutation = useMutation({
    mutationFn: (modelId: string) => startServer(modelId),
    onSuccess: (_data, modelId) => {
      setActiveModel(modelId)
      toast.success('Model loading...')
    },
    onError: () => toast.error('Failed to start model'),
  })

  const stopMutation = useMutation({
    mutationFn: stopServer,
    onSuccess: () => {
      setActiveModel(null)
      toast.success('Model unloaded')
    },
    onError: () => toast.error('Failed to unload model'),
  })

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeModel = models.find((model) => model.id === activeModelId)
  const modelList = data?.models ?? models
  const isLoading = serverStatus === 'starting' || serverStatus === 'stopping' || startMutation.isPending || stopMutation.isPending

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex max-w-[240px] items-center gap-2 border border-border bg-surface-dim px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover"
      >
        <HardDrive className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        <span className="truncate text-text-secondary">
          {activeModel ? activeModel.name : 'No model'}
        </span>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden border-2 border-border bg-surface shadow-[2px_2px_0px_var(--color-border)]">
          {modelList.length === 0 ? (
            <div className="p-5 text-center text-sm text-text-muted">
              No models available. Scan for models on the Models page.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {modelList.map((model) => {
                const isActive = model.id === activeModelId
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (isActive) {
                        stopMutation.mutate()
                      } else if (serverStatus === 'running') {
                        stopMutation.mutate(undefined, {
                          onSuccess: () => startMutation.mutate(model.id),
                        })
                      } else {
                        startMutation.mutate(model.id)
                      }
                      setOpen(false)
                    }}
                    disabled={isLoading}
                    className={cn(
                      'w-full border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0',
                      isActive
                        ? 'border-l-2 border-l-primary bg-primary/6 text-primary'
                        : 'text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <HardDrive className="w-3.5 h-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{model.name}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {formatBytes(model.size_bytes)}
                          {model.quantization && ` · ${model.quantization}`}
                        </span>
                      </span>
                      {isActive && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Active</span>
                      )}
                    </span>
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
