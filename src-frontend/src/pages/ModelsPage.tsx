import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Scan, Trash2, Play, HardDrive, LayoutGrid, List, Search,
  Download, X, FolderOpen, FileDown, ExternalLink,
  Square, AlertCircle
} from 'lucide-react'
import {
  getModels, scanModels, deleteModel, startServer, stopServer,
  importModel, getDownloads, cancelDownload, searchHuggingFace,
  type Model, type DownloadInfo, type HuggingFaceModel,
} from '@/lib/api'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { formatBytes, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type ViewMode = 'grid' | 'list'
type Tab = 'local' | 'browse' | 'downloads'

interface ModelDetail {
  id: string
  name: string
  path: string
  size_bytes: number
  quantization: string | null
  architecture: string | null
  parameters: string | null
  context_length: number | null
  added_at: string
  last_used: string | null
}

function estimateVram(sizeBytes: number, quant?: string): string {
  const base = sizeBytes * 1.2
  if (quant?.startsWith('Q4')) return `~${formatBytes(base)}`
  if (quant?.startsWith('Q5')) return `~${formatBytes(base)}`
  if (quant?.startsWith('Q8')) return `~${formatBytes(base * 1.1)}`
  if (quant === 'F16') return `~${formatBytes(base * 1.2)}`
  return `~${formatBytes(base)}`
}

export function ModelsPage() {
  const queryClient = useQueryClient()
  const setModels = useModelStore((s) => s.setModels)
  const activeModelId = useModelStore((s) => s.activeModelId)
  const setActiveModel = useModelStore((s) => s.setActiveModel)
  const serverStatus = useServerStore((s) => s.status)

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<Tab>('local')
  const [selectedModel, setSelectedModel] = useState<ModelDetail | null>(null)
  const [hfQuery, setHfQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const result = await getModels()
      setModels(result.models)
      return result
    },
  })

  const { data: downloadsData } = useQuery({
    queryKey: ['downloads'],
    queryFn: getDownloads,
    refetchInterval: 2000,
  })

  const { data: hfResults, isFetching: hfSearching } = useQuery({
    queryKey: ['hf-search', hfQuery],
    queryFn: () => searchHuggingFace(hfQuery),
    enabled: hfQuery.length >= 2,
  })

  const scanMutation = useMutation({
    mutationFn: scanModels,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success(`Found ${data.scanned} new models`)
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

  const importMutation = useMutation({
    mutationFn: importModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      toast.success('Model imported')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const models = data?.models ?? []
  const downloads = downloadsData?.downloads ?? []
  const activeDownloads = downloads.filter((d: DownloadInfo) => d.status === 'downloading' || d.status === 'queued')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (!file.name.endsWith('.gguf')) {
        toast.error(`${file.name} is not a .gguf file`)
      } else {
        toast('Use the Import button to add models from your filesystem')
      }
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleImportPath = () => {
    const path = prompt('Enter the full path to a .gguf model file:')
    if (path?.trim()) {
      importMutation.mutate(path.trim())
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-text">Models</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {models.length} available{activeDownloads.length > 0 && ` · ${activeDownloads.length} downloading`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {serverStatus === 'running' && (
              <button
                onClick={() => stopMutation.mutate()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-error hover:bg-error/10 text-xs font-medium transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}
            <button
              onClick={handleImportPath}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-surface-hover text-xs font-medium transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Scan className="w-3.5 h-3.5" />
              {scanMutation.isPending ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>

        {/* Tabs + View Toggle */}
        <div className="flex items-center justify-between mb-4 border-b border-border">
          <div className="flex gap-0">
            {(['local', 'browse', 'downloads'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-2 text-xs font-medium transition-colors capitalize border-b-2 -mb-px',
                  activeTab === tab
                    ? 'border-primary text-text'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                )}
              >
                {tab === 'downloads' && activeDownloads.length > 0
                  ? `Downloads (${activeDownloads.length})`
                  : tab}
              </button>
            ))}
          </div>
          {activeTab === 'local' && (
            <div className="flex gap-0.5 mb-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1 rounded transition-colors',
                  viewMode === 'list' ? 'text-text' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1 rounded transition-colors',
                  viewMode === 'grid' ? 'text-text' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          className="relative min-h-[400px]"
        >
          {dragOver && (
            <div className="absolute inset-0 border-2 border-dashed border-primary/40 bg-primary/5 rounded-lg z-10 flex items-center justify-center">
              <div className="text-center">
                <FileDown className="w-8 h-8 text-primary/60 mx-auto mb-1" />
                <p className="text-xs font-medium text-primary">Drop .gguf files here</p>
              </div>
            </div>
          )}

          {/* Local Models Tab */}
          {activeTab === 'local' && (
            <>
              {isLoading ? (
                <div className="text-center py-12 text-text-muted text-xs">Loading models...</div>
              ) : models.length === 0 ? (
                <div className="text-center py-16">
                  <Box className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
                  <h2 className="text-sm font-medium text-text mb-1">No models found</h2>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Place .gguf files in your models directory, then click Scan.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                  {models.map((model: Model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isActive={model.id === activeModelId}
                      serverStatus={serverStatus}
                      onSelect={() => setSelectedModel(model)}
                      onLoad={() => { setActiveModel(model.id); startMutation.mutate(model.id) }}
                      onDelete={() => {
                        deleteModel(model.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['models'] })
                          toast.success('Model removed')
                          if (selectedModel?.id === model.id) setSelectedModel(null)
                        })
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {models.map((model: Model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      isActive={model.id === activeModelId}
                      serverStatus={serverStatus}
                      onSelect={() => setSelectedModel(model)}
                      onLoad={() => { setActiveModel(model.id); startMutation.mutate(model.id) }}
                      onDelete={() => {
                        deleteModel(model.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['models'] })
                          toast.success('Model removed')
                          if (selectedModel?.id === model.id) setSelectedModel(null)
                        })
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* HuggingFace Browse Tab */}
          {activeTab === 'browse' && (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-dim border border-border mb-4">
                <Search className="w-3.5 h-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search GGUF models on HuggingFace..."
                  value={hfQuery}
                  onChange={(e) => setHfQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-text text-sm placeholder-text-muted"
                />
                {hfSearching && (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
              </div>
              {hfResults?.models && hfResults.models.length > 0 ? (
                <div className="space-y-2">
                  {hfResults.models.map((model: HuggingFaceModel) => (
                    <div
                      key={model.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-dim hover:bg-surface-hover transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text truncate">{model.id}</div>
                        <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                          <span>{Number(model.downloads).toLocaleString()} downloads</span>
                          <span>{'\u2665'} {model.likes}</span>
                          {model.author && <span>by {model.author}</span>}
                        </div>
                      </div>
                      <a
                        href={`https://huggingface.co/${model.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text text-xs font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                    </div>
                  ))}
                </div>
              ) : hfQuery.length >= 2 && !hfSearching ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  No GGUF models found for &quot;{hfQuery}&quot;
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted text-sm">
                  Search for models on HuggingFace to find GGUF files
                </div>
              )}
            </div>
          )}

          {/* Downloads Tab */}
          {activeTab === 'downloads' && (
            <div>
              {downloads.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  <Download className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
                  No downloads in progress
                </div>
              ) : (
                <div className="space-y-2">
                  {downloads.map((dl: DownloadInfo) => (
                    <DownloadRow key={dl.id} download={dl} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedModel && (
        <ModelDetailPanel
          model={selectedModel}
          isActive={selectedModel.id === activeModelId}
          onClose={() => setSelectedModel(null)}
          onLoad={() => { setActiveModel(selectedModel.id); startMutation.mutate(selectedModel.id) }}
          serverStatus={serverStatus}
        />
      )}
    </div>
  )
}

function ModelCard({ model, isActive, serverStatus, onSelect, onLoad, onDelete }: {
  model: ModelDetail; isActive: boolean; serverStatus: string
  onSelect: () => void; onLoad: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors',
        isActive ? 'border-success/50 bg-success/5' : 'border-border hover:bg-surface-hover'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-md bg-surface-dim flex items-center justify-center">
          <HardDrive className="w-4 h-4 text-text-muted" />
        </div>
        {isActive && (
          <span className="text-[10px] font-medium text-success">Active</span>
        )}
      </div>
      <h3 className="font-medium text-text text-sm truncate mb-1">{model.name}</h3>
      <div className="flex items-center gap-1.5 text-[11px] text-text-muted mb-3">
        <span>{formatBytes(model.size_bytes)}</span>
        {model.quantization && (
          <>
            <span>·</span>
            <span>{model.quantization}</span>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onLoad() }}
          disabled={serverStatus !== 'stopped'}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors disabled:opacity-30"
        >
          <Play className="w-3 h-3" />
          Load
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-md text-text-muted hover:text-error transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function ModelRow({ model, isActive, serverStatus, onSelect, onLoad, onDelete }: {
  model: ModelDetail; isActive: boolean; serverStatus: string
  onSelect: () => void; onLoad: () => void; onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors group',
        isActive ? 'border-success/50 bg-success/5' : 'border-border hover:bg-surface-hover'
      )}
    >
      <div className="w-8 h-8 rounded-md bg-surface-dim flex items-center justify-center shrink-0">
        <HardDrive className="w-4 h-4 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{model.name}</div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
          <span>{formatBytes(model.size_bytes)}</span>
          {model.quantization && (
            <>
              <span>·</span>
              <span>{model.quantization}</span>
            </>
          )}
          <span>·</span>
          <span>{estimateVram(model.size_bytes, model.quantization)} VRAM</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isActive && (
          <span className="text-[10px] font-medium text-success mr-1">Active</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onLoad() }}
          disabled={serverStatus !== 'stopped'}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors disabled:opacity-30"
        >
          <Play className="w-3 h-3" />
          Load
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded-md text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function ModelDetailPanel({ model, isActive, onClose, onLoad, serverStatus }: {
  model: ModelDetail; isActive: boolean
  onClose: () => void; onLoad: () => void; serverStatus: string
}) {
  return (
    <div className="w-72 border-l border-border bg-surface p-5 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-text">Details</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-hover text-text-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-4">
        <DetailField label="Name" value={model.name} />
        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Path</label>
          <p className="text-xs text-text-secondary mt-1 break-all font-mono leading-relaxed">{model.path}</p>
        </div>
        <DetailField label="Size" value={formatBytes(model.size_bytes)} />
        <DetailField label="VRAM" value={estimateVram(model.size_bytes, model.quantization)} />
        {model.quantization && <DetailField label="Quantization" value={model.quantization} />}
        {model.architecture && <DetailField label="Architecture" value={model.architecture} />}
        {model.parameters && <DetailField label="Parameters" value={model.parameters} />}
        {model.context_length && (
          <DetailField label="Context" value={`${model.context_length.toLocaleString()} tokens`} />
        )}
        <DetailField label="Added" value={new Date(model.added_at).toLocaleDateString()} />
        <div className="pt-3 border-t border-border">
          <button
            onClick={onLoad}
            disabled={serverStatus !== 'stopped' || isActive}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white hover:bg-success/90 text-xs font-medium transition-colors disabled:opacity-30"
          >
            <Play className="w-3.5 h-3.5" />
            {isActive ? 'Active' : 'Load Model'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</label>
      <p className="text-sm text-text mt-0.5 break-words">{value}</p>
    </div>
  )
}

function DownloadRow({ download }: { download: DownloadInfo }) {
  const progress = download.total_bytes > 0
    ? Math.round((download.downloaded_bytes / download.total_bytes) * 100)
    : 0

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      <div className="w-8 h-8 rounded-md bg-surface-dim flex items-center justify-center shrink-0">
        {download.status === 'failed'
          ? <AlertCircle className="w-4 h-4 text-error" />
          : <Download className="w-4 h-4 text-text-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text truncate">{download.filename}</div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
          {download.status === 'downloading' && (
            <>
              <span>{progress}%</span>
              <span>{formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}</span>
            </>
          )}
          {download.status === 'complete' && <span className="text-success">Complete</span>}
          {download.status === 'failed' && <span className="text-error">{download.error || 'Failed'}</span>}
          {download.status === 'queued' && <span>Queued</span>}
          {download.status === 'cancelled' && <span>Cancelled</span>}
        </div>
        {download.status === 'downloading' && (
          <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      {(download.status === 'downloading' || download.status === 'queued') && (
        <button
          onClick={() => cancelDownload(download.id)}
          className="p-1 rounded-md text-text-muted hover:text-error transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}