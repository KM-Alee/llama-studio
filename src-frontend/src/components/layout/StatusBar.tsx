import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import { useAppStore } from '@/stores/appStore'

export function StatusBar() {
  const activeModelId = useModelStore((s) => s.activeModelId)
  const models = useModelStore((s) => s.models)
  const serverStatus = useServerStore((s) => s.status)
  const profile = useAppStore((s) => s.profile)

  const activeModel = models.find((m) => m.id === activeModelId)

  return (
    <footer className="h-7 border-t border-border flex items-center justify-between px-4 text-xs text-text-muted bg-surface-dim shrink-0">
      <div className="flex items-center gap-4">
        <span>
          Model: {activeModel ? activeModel.name : 'None'}
        </span>
        {serverStatus === 'running' && (
          <span className="text-success">● Connected</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="capitalize">{profile} mode</span>
        <span>AI Studio v0.1.0</span>
      </div>
    </footer>
  )
}
