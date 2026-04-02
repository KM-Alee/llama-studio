import { useCallback, useEffect, useState } from 'react'
import type { Preset } from '@/lib/api'

const STORAGE_KEY = 'llama-studio-custom-templates'
const CHANGE_EVENT = 'llama-studio-custom-templates-changed'

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
      description: typeof value.description === 'string' || value.description === null
        ? value.description ?? null
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

export function loadCustomTemplates(): Preset[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeTemplate).filter((template): template is Preset => Boolean(template))
  } catch {
    return []
  }
}

export function saveCustomTemplates(templates: Preset[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function createTemplateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`
  }

  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createCustomTemplate(name: string, systemPrompt: string): Preset {
  return {
    id: createTemplateId(),
    name,
    description: null,
    profile: 'normal',
    parameters: {},
    system_prompt: systemPrompt,
    is_builtin: false,
  }
}

export function useCustomTemplates() {
  const [customTemplates, setCustomTemplates] = useState<Preset[]>(() => loadCustomTemplates())

  useEffect(() => {
    const syncTemplates = () => setCustomTemplates(loadCustomTemplates())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        syncTemplates()
      }
    }

    window.addEventListener(CHANGE_EVENT, syncTemplates)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(CHANGE_EVENT, syncTemplates)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const updateCustomTemplates = useCallback((next: Preset[] | ((current: Preset[]) => Preset[])) => {
    setCustomTemplates((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      saveCustomTemplates(resolved)
      return resolved
    })
  }, [])

  return { customTemplates, setCustomTemplates: updateCustomTemplates }
}
