import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock3,
  Database,
  HardDrive,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { getModelAnalytics, getModelInspection, getModels } from '@/lib/api'
import { cn, formatBytes, formatDate } from '@/lib/utils'

/* ─── Sub-components ─────────────────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  loading,
  accent = false,
}: {
  icon: ReactNode
  label: string
  value: string | number
  loading?: boolean
  accent?: boolean
}) {
  return (
    <div className={cn('border-2 p-4', accent ? 'border-primary bg-primary/5' : 'border-border bg-surface')}>
      <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('mt-3 font-mono text-3xl font-black tabular-nums', accent ? 'text-primary' : 'text-text')}>
        {loading ? <span className="text-xl text-text-muted">—</span> : value}
      </div>
    </div>
  )
}

function HorizontalBar({ label, value, max, mono = false }: { label: string; value: number; max: number; mono?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-28 shrink-0 truncate text-right text-[11px]', mono ? 'font-mono text-text-muted' : 'text-text-secondary')}>
        {label}
      </span>
      <div className="relative flex h-5 flex-1 border border-border bg-surface-dim overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-end pr-2 font-mono text-[10px] font-bold text-text">
          {value > 0 ? value.toLocaleString() : ''}
        </span>
      </div>
    </div>
  )
}

function RatioBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="font-mono text-xs font-bold text-text">{value}</span>
      </div>
      <div className="h-2 border border-border bg-surface-dim">
        <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */

export function ModelAnalyticsPage() {
  const navigate = useNavigate()
  const { modelId } = useParams<{ modelId?: string }>()

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  })

  const models = modelsData?.models ?? []
  const selectedModel = models.find((m) => m.id === modelId) ?? models[0] ?? null

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

  const analytics = analyticsData?.analytics
  const recentConvs = analytics?.recent_conversations ?? []
  const maxTokens = recentConvs.length > 0 ? Math.max(...recentConvs.map((c) => c.total_tokens)) : 1
  const assistantRate = analytics && analytics.message_count > 0
    ? (analytics.assistant_message_count / analytics.message_count) * 100
    : 0
  const attachmentPerMessage = analytics && analytics.message_count > 0
    ? analytics.attachment_count / analytics.message_count
    : 0

  if (!modelsLoading && models.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md border-2 border-border bg-surface-dim px-8 py-10 text-center">
          <HardDrive className="mx-auto mb-4 h-10 w-10 text-text-muted/40" />
          <h1 className="text-lg font-bold text-text">No models available</h1>
          <p className="mt-2 text-sm text-text-muted">
            Add or download a GGUF model first, then come back here.
          </p>
          <button
            onClick={() => navigate('/models')}
            className="mt-5 inline-flex items-center gap-2 border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
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
      {/* Sidebar — model list */}
      <aside className="w-72 shrink-0 border-r-2 border-border bg-surface-dim">
        <div className="border-b-2 border-border p-4">
          <button
            onClick={() => navigate('/models')}
            className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Models
          </button>
          <div className="mt-4">
            <h1 className="font-mono text-xs font-black uppercase tracking-[0.18em] text-text">Analytics</h1>
            <p className="mt-0.5 text-xs text-text-muted">Usage metrics &amp; model inspection</p>
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => navigate(`/models/analytics/${model.id}`)}
              className={cn(
                'w-full border-l-2 px-4 py-3 text-left transition-colors',
                selectedModel?.id === model.id
                  ? 'border-l-primary bg-surface-hover'
                  : 'border-l-transparent hover:bg-surface-hover/60',
              )}
            >
              <div className="truncate text-sm font-semibold text-text">{model.name}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {formatBytes(model.size_bytes)}
                {model.quantization && ` · ${model.quantization}`}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {selectedModel ? (
          <div className="mx-auto max-w-5xl space-y-8 p-6">

            {/* Model header */}
            <div className="border-2 border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    ▣ {inspectionData?.inspection.architecture ?? 'Model'}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-text">{selectedModel.name}</h2>
                  <p className="mt-1 font-mono text-xs text-text-muted">{selectedModel.path}</p>
                </div>
                <div className="shrink-0 border border-border bg-surface-dim px-4 py-3 text-right">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Added</div>
                  <div className="mt-0.5 text-sm font-semibold text-text">{formatDate(selectedModel.added_at)}</div>
                  {selectedModel.last_used && (
                    <>
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">Last used</div>
                      <div className="mt-0.5 text-sm font-semibold text-text">{formatDate(selectedModel.last_used)}</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top metrics */}
            <div>
              <SectionLabel>Usage Overview</SectionLabel>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricCard icon={<MessageSquare className="h-3.5 w-3.5" />} label="Conversations" value={analytics?.conversation_count ?? 0} loading={analyticsLoading} accent />
                <MetricCard icon={<Sparkles className="h-3.5 w-3.5" />} label="Asst. Tokens" value={(analytics?.total_tokens ?? 0).toLocaleString()} loading={analyticsLoading} />
                <MetricCard icon={<Clock3 className="h-3.5 w-3.5" />} label="Avg Response" value={analytics?.avg_generation_time_ms != null ? `${(analytics.avg_generation_time_ms / 1000).toFixed(1)}s` : '—'} loading={analyticsLoading} />
                <MetricCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Throughput" value={analytics?.tokens_per_second != null ? `${analytics.tokens_per_second.toFixed(1)}/s` : '—'} loading={analyticsLoading} />
              </div>
            </div>

            {/* Token distribution chart + usage breakdown */}
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              {/* Token chart */}
              <div className="border-2 border-border bg-surface p-5">
                <SectionLabel>Token Distribution by Conversation</SectionLabel>
                {recentConvs.length > 0 ? (
                  <div className="space-y-2">
                    {recentConvs.slice(0, 10).map((conv) => (
                      <HorizontalBar
                        key={conv.id}
                        label={conv.title}
                        value={conv.total_tokens}
                        max={maxTokens}
                        mono
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No conversation data yet.</p>
                )}
              </div>

              {/* Ratios + counts */}
              <div className="border-2 border-border bg-surface p-5">
                <SectionLabel>Message Breakdown</SectionLabel>
                <div className="space-y-4 mb-5">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Messages', val: analytics?.message_count ?? 0 },
                      { label: 'Responses', val: analytics?.assistant_message_count ?? 0 },
                      { label: 'Attachments', val: analytics?.attachment_count ?? 0 },
                    ].map(({ label, val }) => (
                      <div key={label} className="border border-border bg-surface-dim p-3">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</div>
                        <div className="mt-1.5 font-mono text-xl font-black text-text">
                          {analyticsLoading ? '—' : val}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <RatioBar label="Assistant message rate" value={`${assistantRate.toFixed(1)}%`} percent={assistantRate} />
                    <RatioBar
                      label="Attachments / message"
                      value={attachmentPerMessage.toFixed(2)}
                      percent={Math.min(100, attachmentPerMessage * 100)}
                    />
                  </div>
                </div>

                <SectionLabel>Generation Time</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-border bg-surface-dim p-3">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Total</div>
                    <div className="mt-1.5 font-mono text-lg font-black text-text">
                      {analytics?.total_generation_time_ms != null
                        ? `${(analytics.total_generation_time_ms / 1000).toFixed(1)}s`
                        : '—'}
                    </div>
                  </div>
                  <div className="border border-border bg-surface-dim p-3">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Context</div>
                    <div className="mt-1.5 font-mono text-lg font-black text-text">
                      {analytics?.context_length?.toLocaleString() ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* llama.cpp inspection */}
            <div className="border-2 border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel>llama.cpp Inspection</SectionLabel>
                {inspectionLoading && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Inspecting…</span>
                )}
              </div>

              {inspectionData?.inspection ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {[
                      { label: 'Architecture', val: inspectionData.inspection.architecture ?? '—' },
                      { label: 'Parameters', val: inspectionData.inspection.model_params ?? '—' },
                      { label: 'Context', val: inspectionData.inspection.context_length != null ? `${inspectionData.inspection.context_length.toLocaleString()} tok` : '—' },
                      { label: 'File type', val: inspectionData.inspection.file_type ?? '—' },
                    ].map(({ label, val }) => (
                      <div key={label} className="border border-border bg-surface-dim p-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">{label}</div>
                        <div className="mt-1.5 text-sm font-bold text-text">{val}</div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border bg-surface-dim px-4 py-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Command</div>
                    <div className="mt-2 break-all font-mono text-xs text-text-secondary">{inspectionData.inspection.command}</div>
                  </div>

                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Metadata</div>
                    <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                      {inspectionData.inspection.metadata.slice(0, 18).map((entry) => (
                        <div key={entry.key} className="border border-border bg-surface-dim px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{entry.key}</div>
                          <div className="mt-0.5 break-words text-xs font-medium text-text">{entry.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Inspection data will appear once llama.cpp returns metadata for this model.
                </p>
              )}
            </div>

            {/* Recent conversations table */}
            <div className="border-2 border-border bg-surface">
              <div className="flex items-center justify-between border-b-2 border-border px-5 py-3">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                  Recent Conversations
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
                  <Database className="h-3 w-3" />
                  Local DB
                </div>
              </div>
              {recentConvs.length > 0 ? (
                <div>
                  <div className="grid grid-cols-[1fr_80px_80px_80px] border-b border-border bg-surface-dim px-5 py-2">
                    {['Title', 'Responses', 'Tokens', 'Updated'].map((h) => (
                      <div key={h} className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{h}</div>
                    ))}
                  </div>
                  {recentConvs.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                      className="grid w-full grid-cols-[1fr_80px_80px_80px] border-b border-border px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-hover"
                    >
                      <div className="min-w-0 truncate text-sm font-medium text-text">{conv.title}</div>
                      <div className="font-mono text-sm font-bold text-text">{conv.assistant_messages}</div>
                      <div className="font-mono text-sm font-bold text-text">{conv.total_tokens.toLocaleString()}</div>
                      <div className="font-mono text-xs text-text-muted">{formatDate(conv.updated_at)}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-text-muted">No tracked conversations for this model yet.</p>
              )}
            </div>

          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">Loading models…</span>
          </div>
        )}
      </main>
    </div>
  )
}
