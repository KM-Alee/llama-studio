import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { useAppStore } from '@/stores/appStore'
import { formatBytes } from '@/lib/utils'

export function StatusBar() {
  const activeModelId = useModelStore((s) => s.activeModelId)
  const models = useModelStore((s) => s.models)
  const serverStatus = useServerStore((s) => s.status)
  const profile = useAppStore((s) => s.profile)

  const activeModel = models.find((m) => m.id === activeModelId)

  return (
    <footer className="h-7 border-t border-border flex items-center justify-between px-4 text-xs text-text-muted bg-surface-dim shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span>{activeModel ? activeModel.name : 'No model loaded'}</span>
        {activeModel && (
          <span className="text-text-muted/60">{formatBytes(activeModel.sizeBytes)}</span>
        )}
        {serverStatus === 'running' && (
          <span className="text-success font-medium">● Connected</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted border border-border rounded bg-surface-dim">Ctrl+K</kbd>
        <span className="capitalize font-medium">{profile}</span>
        <span className="text-text-muted/60">v0.1.0</span>
      </div>
    </footer>
  )
}
