import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Clock3, Cpu, HardDrive, MessageSquare, Sparkles } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { getModelAnalytics, getModelInspection, getModels } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'

export function ModelAnalyticsPage() {
  const navigate = useNavigate()
  const { modelId } = useParams<{ modelId?: string }>()

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  })

  const models = modelsData?.models ?? []
  const selectedModel = models.find((model) => model.id === modelId) ?? models[0] ?? null

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['model-analytics', selectedModel?.id],
    queryFn: () => getModelAnalytics(selectedModel!.id),
    enabled: selectedModel !== null,
  })

  const { data: inspectionData, isLoading: inspectionLoading } = useQuery({
    queryKey: ['model-inspection', selectedModel?.id],
    queryFn: () => getModelInspection(selectedModel!.id),
    enabled: selectedModel !== null,
  })

  if (!modelsLoading && models.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-3xl items-center justify-center px-6">
        <div className="rounded-3xl border border-border bg-surface-dim px-8 py-10 text-center">
          <HardDrive className="mx-auto mb-4 h-10 w-10 text-text-muted/40" />
          <h1 className="text-lg font-semibold text-text">No models available</h1>
          <p className="mt-2 max-w-md text-sm text-text-muted">
            Add or download a GGUF model first, then come back here for usage analytics and llama.cpp inspection details.
          </p>
          <button
            onClick={() => navigate('/models')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Models
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-border bg-surface-dim/60 p-5">
        <button
          onClick={() => navigate('/models')}
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Models
        </button>

        <div className="mb-4">
          <h1 className="text-lg font-semibold text-text">Model Analytics</h1>
          <p className="mt-1 text-sm text-text-muted">
            Inspect runtime metadata from llama.cpp and compare how each local model has been used.
          </p>
        </div>

        <div className="space-y-2">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => navigate(`/models/analytics/${model.id}`)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                selectedModel?.id === model.id
                  ? 'border-primary/45 bg-primary/8'
                  : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <div className="truncate text-sm font-semibold text-text">{model.name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                <span>{formatBytes(model.size_bytes)}</span>
                {model.quantization && <span>· {model.quantization}</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {selectedModel ? (
          <div className="mx-auto max-w-5xl space-y-6">
            <section className="rounded-3xl border border-border bg-surface-dim p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    <Activity className="h-3.5 w-3.5" />
                    Analytics
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-text">{selectedModel.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-text-muted">
                    {inspectionData?.inspection.general_name ?? selectedModel.path}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
                  <div>Added {formatDate(selectedModel.added_at)}</div>
                  <div className="mt-1">{selectedModel.last_used ? `Last used ${formatDate(selectedModel.last_used)}` : 'Not used in a tracked chat yet'}</div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<MessageSquare className="h-4 w-4" />} label="Conversations" value={analyticsData?.analytics.conversation_count ?? 0} loading={analyticsLoading} />
              <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Assistant Tokens" value={(analyticsData?.analytics.total_tokens ?? 0).toLocaleString()} loading={analyticsLoading} />
              <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Average Response" value={analyticsData?.analytics.avg_generation_time_ms != null ? `${(analyticsData.analytics.avg_generation_time_ms / 1000).toFixed(1)} s` : 'No data'} loading={analyticsLoading} />
              <MetricCard icon={<Cpu className="h-4 w-4" />} label="Throughput" value={analyticsData?.analytics.tokens_per_second != null ? `${analyticsData.analytics.tokens_per_second.toFixed(1)} tok/s` : 'No data'} loading={analyticsLoading} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-border bg-surface-dim p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-text">llama.cpp Inspection</h3>
                    <p className="mt-1 text-sm text-text-muted">Live metadata captured from a real `llama-cli -v` invocation.</p>
                  </div>
                  {inspectionLoading && <span className="text-sm text-text-muted">Inspecting…</span>}
                </div>

                {inspectionData?.inspection ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <MetricCard icon={<Cpu className="h-4 w-4" />} label="Architecture" value={inspectionData.inspection.architecture ?? 'Unknown'} compact />
                      <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Model Params" value={inspectionData.inspection.model_params ?? 'Unknown'} compact />
                      <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Context" value={inspectionData.inspection.context_length != null ? `${inspectionData.inspection.context_length.toLocaleString()} tokens` : 'Unknown'} compact />
                      <MetricCard icon={<HardDrive className="h-4 w-4" />} label="File Type" value={inspectionData.inspection.file_type ?? 'Unknown'} compact />
                    </div>

                    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Command</div>
                      <div className="mt-2 break-all font-mono text-xs text-text-secondary">{inspectionData.inspection.command}</div>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Metadata Keys</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {inspectionData.inspection.metadata.slice(0, 14).map((entry) => (
                          <div key={entry.key} className="rounded-xl bg-surface-dim px-3 py-2">
                            <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{entry.key}</div>
                            <div className="mt-1 break-words text-sm text-text">{entry.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Inspection data will appear here as soon as llama.cpp returns metadata for this model.</p>
                )}
              </div>

              <div className="rounded-3xl border border-border bg-surface-dim p-6">
                <h3 className="text-base font-semibold text-text">Usage Breakdown</h3>
                <div className="mt-4 space-y-3">
                  <MetricCard icon={<MessageSquare className="h-4 w-4" />} label="Messages" value={analyticsData?.analytics.message_count ?? 0} compact loading={analyticsLoading} />
                  <MetricCard icon={<Sparkles className="h-4 w-4" />} label="Responses" value={analyticsData?.analytics.assistant_message_count ?? 0} compact loading={analyticsLoading} />
                  <MetricCard icon={<HardDrive className="h-4 w-4" />} label="Attachments" value={analyticsData?.analytics.attachment_count ?? 0} compact loading={analyticsLoading} />
                  <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Total Generation Time" value={analyticsData?.analytics.total_generation_time_ms != null ? `${(analyticsData.analytics.total_generation_time_ms / 1000).toFixed(1)} s` : '0 s'} compact loading={analyticsLoading} />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-surface-dim p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text">Recent Conversations</h3>
                  <p className="mt-1 text-sm text-text-muted">Only conversations created while this model was selected are counted here.</p>
                </div>
              </div>

              {analyticsData?.analytics.recent_conversations.length ? (
                <div className="space-y-2">
                  {analyticsData.analytics.recent_conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => navigate(`/chat/${conversation.id}`)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text">{conversation.title}</div>
                        <div className="mt-1 text-xs text-text-muted">Updated {formatDate(conversation.updated_at)}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-text-muted">
                        <div>{conversation.assistant_messages} responses</div>
                        <div className="mt-1">{conversation.total_tokens.toLocaleString()} tokens</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No tracked conversations for this model yet.</p>
              )}
            </section>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">Loading models…</div>
        )}
      </main>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  loading,
  compact = false,
}: {
  icon: ReactNode
  label: string
  value: string | number
  loading?: boolean
  compact?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 font-semibold text-text ${compact ? 'text-lg' : 'text-2xl'}`}>
        {loading ? '...' : value}
      </div>
    </div>
  )
}