import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Scan, Trash2, Play, HardDrive } from 'lucide-react'
import { getModels, scanModels, deleteModel, startServer, stopServer } from '@/lib/api'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { formatBytes } from '@/lib/utils'
import toast from 'react-hot-toast'

export function ModelsPage() {
  const queryClient = useQueryClient()
  const setModels = useModelStore((s) => s.setModels)
  const activeModelId = useModelStore((s) => s.activeModelId)
  const setActiveModel = useModelStore((s) => s.setActiveModel)
  const serverStatus = useServerStore((s) => s.status)

  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const result = await getModels()
      setModels(result.models)
      return result
    },
  })

  const scanMutation = useMutation({
    mutationFn: scanModels,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`Found ${data.scanned} models`)
    },
    onError: () => toast.error('Failed to scan models'),
  })

  const startMutation = useMutation({
    mutationFn: (modelId: string) => startServer(modelId),
    onSuccess: () => toast.success('Model loading...'),
    onError: () => toast.error('Failed to start server'),
  })

  const stopMutation = useMutation({
    mutationFn: stopServer,
    onSuccess: () => {
      setActiveModel(null)
      toast.success('Server stopped')
    },
  })

  const models = data?.models ?? []

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Models</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your local GGUF models
          </p>
        </div>
        <div className="flex gap-2">
          {serverStatus === 'running' && (
            <button
              onClick={() => stopMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error hover:bg-error/20 text-sm font-medium transition-colors"
            >
              Stop Server
            </button>
          )}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Scan className="w-4 h-4" />
            {scanMutation.isPending ? 'Scanning...' : 'Scan for Models'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading models...</div>
      ) : models.length === 0 ? (
        <div className="text-center py-20">
          <Box className="w-16 h-16 text-text-muted/30 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-text mb-2">No models found</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
            Place .gguf model files in your models directory, then click "Scan for Models" to detect them.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {models.map((model: any) => (
            <div
              key={model.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-dim hover:bg-surface-hover transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text truncate">{model.name}</div>
                <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                  <span>{formatBytes(model.size_bytes)}</span>
                  {model.quantization && <span className="px-1.5 py-0.5 bg-surface rounded text-text-secondary">{model.quantization}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveModel(model.id)
                    startMutation.mutate(model.path)
                  }}
                  disabled={serverStatus === 'running'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors disabled:opacity-30"
                >
                  <Play className="w-3 h-3" />
                  Load
                </button>
                <button
                  onClick={() => {
                    if (confirm('Remove this model from the registry?')) {
                      deleteModel(model.id).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['models'] })
                        toast.success('Model removed')
                      })
                    }
                  }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
