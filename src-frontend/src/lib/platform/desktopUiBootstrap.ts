import type { Preset, UiPreferences } from '@/lib/apiTypes'
import { getUiPreferences, mergeBrowserUiMigration } from '@/lib/api'
import { useAppStore, type Profile, type Theme } from '@/stores/appStore'
import { setDesktopCustomTemplatesFromDb } from '@/lib/customTemplates'

const APP_STORAGE_KEY = 'llamastudio-app'
const LEGACY_APP_STORAGE_KEY = 'ai-studio-app'
const CUSTOM_TEMPLATES_KEY = 'llama-studio-custom-templates'

function readRawZustandPersist(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }
  const current = window.localStorage.getItem(APP_STORAGE_KEY)
  if (current != null) return current
  const legacy = window.localStorage.getItem(LEGACY_APP_STORAGE_KEY)
  if (legacy != null) {
    window.localStorage.setItem(APP_STORAGE_KEY, legacy)
    window.localStorage.removeItem(LEGACY_APP_STORAGE_KEY)
  }
  return window.localStorage.getItem(APP_STORAGE_KEY)
}

function extractZustandPersistState(parsed: unknown): unknown {
  if (parsed && typeof parsed === 'object' && 'state' in (parsed as object)) {
    return (parsed as { state: unknown }).state
  }
  return parsed
}

function readLegacyAppPrefsObject(): Record<string, unknown> | null {
  const raw = readRawZustandPersist()
  if (raw == null) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    const state = extractZustandPersistState(parsed)
    if (!state || typeof state !== 'object' || state === null) {
      return null
    }
    return state as Record<string, unknown>
  } catch {
    return null
  }
}

/** Keys we persist in SQLite `app_prefs` (matches Zustand `partialize`). */
function zustandStateToAppPrefsPatch(
  state: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  if (state.profile === 'normal' || state.profile === 'advanced') {
    out.profile = state.profile
  }
  if (state.theme === 'light' || state.theme === 'dark' || state.theme === 'system') {
    out.theme = state.theme
  }
  if (typeof state.sidebarOpen === 'boolean') {
    out.sidebarOpen = state.sidebarOpen
  }
  return Object.keys(out).length > 0 ? out : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeTemplate(value: unknown): Preset | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null
  }
  if (typeof value.system_prompt === 'string' || value.system_prompt === null) {
    return {
      id: value.id,
      name: value.name,
      description:
        typeof value.description === 'string' || value.description === null
          ? (value.description ?? null)
          : null,
      profile: typeof value.profile === 'string' ? value.profile : 'normal',
      parameters: isRecord(value.parameters) ? value.parameters : {},
      system_prompt: typeof value.system_prompt === 'string' ? value.system_prompt : null,
      is_builtin: typeof value.is_builtin === 'boolean' ? value.is_builtin : false,
    }
  }
  if (typeof value.prompt === 'string') {
    return {
      id: value.id,
      name: value.name,
      description: null,
      profile: 'normal',
      parameters: {},
      system_prompt: value.prompt,
      is_builtin: false,
    }
  }
  return null
}

function readLegacyCustomTemplatesList(): { templates: Preset[]; hadKey: boolean } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { templates: [], hadKey: false }
  }
  const raw = window.localStorage.getItem(CUSTOM_TEMPLATES_KEY)
  if (raw == null) {
    return { templates: [], hadKey: false }
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return { templates: [], hadKey: true }
    }
    const templates = parsed
      .map(normalizeTemplate)
      .filter((t): t is Preset => Boolean(t))
    return { templates, hadKey: true }
  } catch {
    return { templates: [], hadKey: true }
  }
}

function applyAppPrefsToStore(appPrefs: Record<string, unknown>): void {
  const patch: Partial<{
    profile: Profile
    theme: Theme
    sidebarOpen: boolean
  }> = {}
  if (appPrefs.profile === 'normal' || appPrefs.profile === 'advanced') {
    patch.profile = appPrefs.profile
  }
  if (appPrefs.theme === 'light' || appPrefs.theme === 'dark' || appPrefs.theme === 'system') {
    patch.theme = appPrefs.theme
  }
  if (typeof appPrefs.sidebarOpen === 'boolean') {
    patch.sidebarOpen = appPrefs.sidebarOpen
  }
  if (Object.keys(patch).length > 0) {
    useAppStore.setState(patch)
  }
}

function applyUiPreferencesToApp(ui: UiPreferences): void {
  applyAppPrefsToStore(ui.app_prefs)
  setDesktopCustomTemplatesFromDb(
    Array.isArray(ui.custom_templates) ? ui.custom_templates : [],
  )
}

function clearBrowserLegacyKeys(clearedApp: boolean, clearedTemplates: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (clearedApp) {
    window.localStorage.removeItem(APP_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_APP_STORAGE_KEY)
  }
  if (clearedTemplates) {
    window.localStorage.removeItem(CUSTOM_TEMPLATES_KEY)
  }
}

/**
 * On native desktop: migrate optional browser `localStorage` into SQLite, then
 * hydrate Zustand + in-memory custom templates from `get_ui_preferences` / merge result.
 */
export async function bootstrapDesktopUiFromLegacy(): Promise<void> {
  try {
    const hadAppKey =
      typeof window !== 'undefined' &&
      window.localStorage != null &&
      (window.localStorage.getItem(APP_STORAGE_KEY) != null ||
        window.localStorage.getItem(LEGACY_APP_STORAGE_KEY) != null)

    const zustandState = readLegacyAppPrefsObject()
    const appPatch = zustandState ? zustandStateToAppPrefsPatch(zustandState) : null
    const { templates: legacyTemplates, hadKey: hadTemplatesKey } = readLegacyCustomTemplatesList()

    const hasAppMigration = appPatch != null
    const hasTemplateMigration = legacyTemplates.length > 0
    const shouldMerge = hasAppMigration || hasTemplateMigration

    if (shouldMerge) {
      const ui = await mergeBrowserUiMigration(
        hasAppMigration ? appPatch : undefined,
        hasTemplateMigration ? legacyTemplates : undefined,
      )
      applyUiPreferencesToApp(ui)
    } else {
      const ui = await getUiPreferences()
      applyUiPreferencesToApp(ui)
    }
    // Drop browser-origin keys so prefs stay DB-backed; safe after successful load/merge.
    clearBrowserLegacyKeys(hadAppKey, hadTemplatesKey)
  } catch (e) {
    console.error('[llamastudio] desktop UI preferences bootstrap failed', e)
    setDesktopCustomTemplatesFromDb([])
    try {
      const ui = await getUiPreferences()
      applyUiPreferencesToApp(ui)
    } catch {
      // leave Zustand defaults; templates already cleared above
    }
  }
}
