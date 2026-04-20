import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { checkForDesktopUpdate } from '@/lib/desktopUpdates'

interface PendingUpdate {
  version: string
  notes: string
  install: () => Promise<void>
}

export function UpdateNotice() {
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    let cancelled = false

    void checkForDesktopUpdate()
      .then((update) => {
        if (!cancelled && update) {
          setPendingUpdate(update)
        }
      })
      .catch(() => {
        // Silent in browser mode or when updater is not configured for local development.
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!pendingUpdate) return null

  return (
    <Modal open={true} onClose={() => setPendingUpdate(null)} title="Update Available">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          LlamaStudio {pendingUpdate.version} is available.
        </p>
        <div className="border border-border bg-surface-dim p-3 text-sm text-text-secondary whitespace-pre-wrap">
          {pendingUpdate.notes}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingUpdate(null)}
            className="ui-button ui-button-secondary"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              setInstalling(true)
              void pendingUpdate.install()
            }}
            disabled={installing}
            className="ui-button ui-button-primary"
          >
            <RefreshCw className={`h-4 w-4 ${installing ? 'animate-spin' : ''}`} />
            {installing ? 'Installing…' : 'Update Now'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
