import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

import { isDesktopRuntime } from '@/lib/platform/env'

export interface UpdateResult {
  version: string
  notes: string
  install: () => Promise<void>
}

export async function checkForDesktopUpdate(): Promise<UpdateResult | null> {
  if (!isDesktopRuntime()) return null

  const update = await check()
  if (!update) return null

  return {
    version: update.version,
    notes: update.body ?? 'A new LlamaStudio release is ready to install.',
    install: async () => {
      await update.downloadAndInstall()
      await relaunch()
    },
  }
}
