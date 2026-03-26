import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box, Scan, Trash2, Play, HardDrive, LayoutGrid, List, Search,
  Download, X, FolderOpen, FileDown, ExternalLink,
  Square, AlertCircle, ChevronDown, ChevronRight, Heart
} from 'lucide-react'
import {
  getModels, scanModels, deleteModel, startServer, stopServer,
  importModel, getDownloads, cancelDownload, searchHuggingFace,
  getHuggingFaceFiles, startDownload,
  type Model, type DownloadInfo, type HuggingFaceModel, type HuggingFaceFile,
} from '@/lib/api'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { formatBytes, cn } from '@/lib/utils'
import { InputModal, ConfirmModal } from '@/components/ui/Modal'
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

function extractQuantFromFilename(filename: string): string | null {
  const match = filename.match(/[.-](Q\d[^.]*|F16|F32|IQ\d[^.]*)/i)
  return match ? match[1].toUpperCase() : null
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
  const [expandedHfModel, setExpandedHfModel] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [deleteModelTarget, setDeleteModelTarget] = useState<string | null>(null)

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

  const handleImportPath = (path: string) => {
    importMutation.mutate(path)
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Models</h1>
            <p className="text-sm text-text-muted mt-1">
              {models.length} available{activeDownloads.length > 0 && ` · ${activeDownloads.length} downloading`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {serverStatus === 'running' && (
              <button
                onClick={() => stopMutation.mutate()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-error hover:bg-error/10 text-sm font-medium transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Stop Server
              </button>
            )}
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-text-secondary hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Scan className="w-4 h-4" />
              {scanMutation.isPending ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>

        {/* Tabs + View Toggle */}
        <div className="flex items-center justify-between mb-5 border-b border-border">
          <div className="flex gap-0">
            {(['local', 'browse', 'downloads'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors capitalize border-b-2 -mb-px',
                  activeTab === tab
                    ? 'border-primary text-text'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                )}
              >
                {tab === 'downloads' && activeDownloads.length > 0
                  ? `Downloads (${activeDownloads.length})`
                  : tab === 'browse' ? 'HuggingFace' : tab}
              </button>
            ))}
          </div>
          {activeTab === 'local' && (
            <div className="flex gap-1 mb-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'list' ? 'text-text bg-surface-hover' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  viewMode === 'grid' ? 'text-text bg-surface-hover' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
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
            <div className="absolute inset-0 border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl z-10 flex items-center justify-center">
              <div className="text-center">
                <FileDown className="w-10 h-10 text-primary/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Drop .gguf files here</p>
              </div>
            </div>
          )}

          {/* Local Models Tab */}
          {activeTab === 'local' && (
            <>
              {isLoading ? (
                <div className="text-center py-16 text-text-muted text-sm">Loading models...</div>
              ) : models.length === 0 ? (
                <div className="text-center py-20">
                  <Box className="w-12 h-12 text-text-muted/20 mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-text mb-1.5">No models found</h2>
                  <p className="text-sm text-text-muted max-w-sm mx-auto">
                    Place .gguf files in your models directory, then click Scan. Or browse HuggingFace to download models.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {models.map((model: Model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isActive={model.id === activeModelId}
                      serverStatus={serverStatus}
                      onSelect={() => setSelectedModel(model)}
                      onLoad={() => { setActiveModel(model.id); startMutation.mutate(model.id) }}
                      onDelete={() => setDeleteModelTarget(model.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {models.map((model: Model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      isActive={model.id === activeModelId}
                      serverStatus={serverStatus}
                      onSelect={() => setSelectedModel(model)}
                      onLoad={() => { setActiveModel(model.id); startMutation.mutate(model.id) }}
                      onDelete={() => setDeleteModelTarget(model.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* HuggingFace Browse Tab */}
          {activeTab === 'browse' && (
            <div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-dim border border-border mb-5">
                <Search className="w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search GGUF models on HuggingFace..."
                  value={hfQuery}
                  onChange={(e) => setHfQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-text text-sm placeholder-text-muted"
                />
                {hfSearching && (
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
              </div>

              {hfResults?.models && hfResults.models.length > 0 ? (
                <div className="space-y-2">
                  {hfResults.models.map((model: HuggingFaceModel) => (
                    <HuggingFaceModelCard
                      key={model.id}
                      model={model}
                      isExpanded={expandedHfModel === model.id}
                      onToggle={() => setExpandedHfModel(expandedHfModel === model.id ? null : model.id)}
                    />
                  ))}
                </div>
              ) : hfQuery.length >= 2 && !hfSearching ? (
                <div className="text-center py-16">
                  <Search className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No GGUF models found for &quot;{hfQuery}&quot;</p>
                </div>
              ) : (
                <div className="text-center py-16">
                  <Download className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-text mb-1.5">Browse HuggingFace</h3>
                  <p className="text-sm text-text-muted max-w-sm mx-auto">
                    Search for GGUF models and download them directly. Try &quot;llama&quot;, &quot;mistral&quot;, or &quot;phi&quot;.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Downloads Tab */}
          {activeTab === 'downloads' && (
            <div>
              {downloads.length === 0 ? (
                <div className="text-center py-16 text-text-muted text-sm">
                  <Download className="w-12 h-12 text-text-muted/20 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-text mb-1.5">No downloads</h3>
                  <p className="text-sm text-text-muted">Browse HuggingFace to find and download models.</p>
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

      <InputModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSubmit={handleImportPath}
        title="Import Model"
        description="Enter the full path to a .gguf model file on your system."
        placeholder="/path/to/model.gguf"
        submitLabel="Import"
      />

      <ConfirmModal
        open={deleteModelTarget !== null}
        onClose={() => setDeleteModelTarget(null)}
        onConfirm={() => {
          if (deleteModelTarget) {
            deleteModel(deleteModelTarget).then(() => {
              queryClient.invalidateQueries({ queryKey: ['models'] })
              toast.success('Model removed')
              if (selectedModel?.id === deleteModelTarget) setSelectedModel(null)
            })
          }
        }}
        title="Remove model"
        description="This will remove the model from Llama Studio. The file will not be deleted from disk."
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </div>
  )
}

// HuggingFace model card with expandable file listing
function HuggingFaceModelCard({ model, isExpanded, onToggle }: {
  model: HuggingFaceModel; isExpanded: boolean; onToggle: () => void
}) {
  const queryClient = useQueryClient()

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['hf-files', model.id],
    queryFn: () => getHuggingFaceFiles(model.id),
    enabled: isExpanded,
  })

  const handleDownload = async (file: HuggingFaceFile) => {
    const url = `https://huggingface.co/${model.id}/resolve/main/${file.filename}`
    try {
      await startDownload(url, file.filename)
      toast.success(`Downloading ${file.filename}`)
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
    } catch {
      toast.error('Failed to start download')
    }
  }

  const files = filesData?.files ?? []

  return (
    <div className="rounded-xl border border-border bg-surface-dim overflow-hidden transition-colors hover:border-border/80">
      {/* Model header — always visible */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-hover/50 transition-colors"
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
          <Box className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text text-sm truncate">{model.id}</div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {Number(model.downloads).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {model.likes}
            </span>
            {model.author && <span>by {model.author}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://huggingface.co/${model.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </a>
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-text-muted" />
            : <ChevronRight className="w-4 h-4 text-text-muted" />
          }
        </div>
      </div>

      {/* Expanded file listing */}
      {isExpanded && (
        <div className="border-t border-border bg-surface">
          {filesLoading ? (
            <div className="p-4 text-center text-sm text-text-muted">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="p-4 text-center text-sm text-text-muted">
              No GGUF files found in this repository.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {files.map((file: HuggingFaceFile) => {
                const quant = extractQuantFromFilename(file.filename)
                return (
                  <div
                    key={file.filename}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
                  >
                    <FileDown className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text truncate font-mono">{file.filename}</div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>{formatBytes(file.size)}</span>
                        {quant && (
                          <span className="px-1.5 py-0.5 rounded bg-surface-dim text-text-secondary text-[10px] font-semibold">
                            {quant}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-medium transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
        'p-4 rounded-xl border cursor-pointer transition-colors',
        isActive ? 'border-success/50 bg-success/5' : 'border-border hover:bg-surface-hover'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-surface-dim flex items-center justify-center">
          <HardDrive className="w-4 h-4 text-text-muted" />
        </div>
        {isActive && (
          <span className="text-xs font-semibold text-success">Active</span>
        )}
      </div>
      <h3 className="font-semibold text-text text-sm truncate mb-1.5">{model.name}</h3>
      <div className="flex items-center gap-2 text-xs text-text-muted mb-4">
        <span>{formatBytes(model.size_bytes)}</span>
        {model.quantization && (
          <>
            <span>·</span>
            <span>{model.quantization}</span>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onLoad() }}
          disabled={serverStatus !== 'stopped'}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 text-sm font-medium transition-colors disabled:opacity-30"
        >
          <Play className="w-3.5 h-3.5" />
          Load
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
        'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors group',
        isActive ? 'border-success/50 bg-success/5' : 'border-border hover:bg-surface-hover'
      )}
    >
      <div className="w-9 h-9 rounded-xl bg-surface-dim flex items-center justify-center shrink-0">
        <HardDrive className="w-4 h-4 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text truncate">{model.name}</div>
        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
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
      <div className="flex items-center gap-2 shrink-0">
        {isActive && (
          <span className="text-xs font-semibold text-success mr-1">Active</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onLoad() }}
          disabled={serverStatus !== 'stopped'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-sm font-medium transition-colors disabled:opacity-30"
        >
          <Play className="w-3.5 h-3.5" />
          Load
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
    <div className="w-80 border-l border-border bg-surface p-5 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-text">Details</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-4">
        <DetailField label="Name" value={model.name} />
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Path</label>
          <p className="text-xs text-text-secondary mt-1.5 break-all font-mono leading-relaxed bg-surface-dim rounded-lg p-2">{model.path}</p>
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
        <div className="pt-4 border-t border-border">
          <button
            onClick={onLoad}
            disabled={serverStatus !== 'stopped' || isActive}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success text-white hover:bg-success/90 text-sm font-semibold transition-colors disabled:opacity-30"
          >
            <Play className="w-4 h-4" />
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
      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</label>
      <p className="text-sm text-text mt-1 break-words">{value}</p>
    </div>
  )
}

function DownloadRow({ download }: { download: DownloadInfo }) {
  const progress = download.total_bytes > 0
    ? Math.round((download.downloaded_bytes / download.total_bytes) * 100)
    : 0

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border">
      <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center shrink-0">
        {download.status === 'failed'
          ? <AlertCircle className="w-5 h-5 text-error" />
          : <Download className="w-5 h-5 text-text-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{download.filename}</div>
        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
          {download.status === 'downloading' && (
            <>
              <span className="font-semibold text-primary">{progress}%</span>
              <span>{formatBytes(download.downloaded_bytes)} / {formatBytes(download.total_bytes)}</span>
            </>
          )}
          {download.status === 'complete' && <span className="text-success font-medium">Complete</span>}
          {download.status === 'failed' && <span className="text-error">{download.error || 'Failed'}</span>}
          {download.status === 'queued' && <span>Queued</span>}
          {download.status === 'cancelled' && <span>Cancelled</span>}
        </div>
        {download.status === 'downloading' && (
          <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
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
          className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}