import { useQuery } from '@tanstack/react-query'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { useAppStore } from '@/stores/appStore'
import { getDownloads } from '@/lib/api'
import { formatBytes } from '@/lib/utils'

export function StatusBar() {
  const activeModelId = useModelStore((s) => s.activeModelId)
  const models = useModelStore((s) => s.models)
  const serverStatus = useServerStore((s) => s.status)
  const profile = useAppStore((s) => s.profile)

  const { data: downloadsData } = useQuery({
    queryKey: ['downloads'],
    queryFn: getDownloads,
    refetchInterval: 2000,
  })

  const activeModel = models.find((model) => model.id === activeModelId)
  const activeDownloads = (downloadsData?.downloads ?? []).filter(
    (download) => download.status === 'downloading' || download.status === 'queued',
  )
  const primaryDownload = activeDownloads[0]

  return (
    <footer className="flex h-7 shrink-0 select-none items-center justify-between border-t border-border bg-surface-dim px-4">
      <div className="flex items-center gap-4 overflow-hidden">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted truncate">
          {activeModel ? activeModel.name : 'No model loaded'}
        </span>
        {activeModel && (
          <span className="font-mono text-[10px] text-text-muted/50">
            {formatBytes(activeModel.size_bytes)}
          </span>
        )}
        {serverStatus === 'running' && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-success">
            ● Live
          </span>
        )}
        {primaryDownload && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary truncate">
            ↓ {primaryDownload.filename} {Math.round(primaryDownload.progress)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <kbd className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
          Ctrl+K
        </kbd>
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted/60">
          {profile}
        </span>
        <span className="font-mono text-[10px] text-text-muted/40">v0.1.0</span>
      </div>
    </footer>
  )
}
