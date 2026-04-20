import { useMemo, useRef, useState } from 'react'
import { X, ChevronDown, Plus, Trash2, Save, PencilLine } from 'lucide-react'
import type { Preset } from '@/lib/api'
import {
  createCustomTemplate,
  isCustomTemplateId,
  useCustomTemplates,
} from '@/lib/customTemplates'

function makeBuiltinTemplate(id: string, name: string, systemPrompt: string): Preset {
  return {
    id,
    name,
    description: null,
    profile: 'normal',
    parameters: {},
    system_prompt: systemPrompt,
    is_builtin: true,
  }
}

const BUILTIN_TEMPLATES: Preset[] = [
  makeBuiltinTemplate('none', 'None', ''),
  makeBuiltinTemplate(
    'helpful',
    'Helpful Assistant',
    'You are a helpful, harmless, and honest assistant.',
  ),
  makeBuiltinTemplate(
    'creative',
    'Creative Writer',
    'You are a creative writing assistant. Be imaginative and expressive.',
  ),
  makeBuiltinTemplate(
    'coder',
    'Code Expert',
    'You are an expert programmer. Write clean, efficient, well-documented code. Explain your reasoning.',
  ),
  makeBuiltinTemplate(
    'analyst',
    'Data Analyst',
    'You are a data analysis expert. Be precise, use numbers, and present findings clearly.',
  ),
  makeBuiltinTemplate(
    'tutor',
    'Patient Tutor',
    'You are a patient and knowledgeable tutor. Explain concepts step by step, check understanding, and use examples.',
  ),
  makeBuiltinTemplate(
    'concise',
    'Concise',
    'Be extremely concise. Answer in as few words as possible while remaining accurate and helpful.',
  ),
  makeBuiltinTemplate(
    'socratic',
    'Socratic Guide',
    'You are a Socratic teacher. Never give answers directly — instead ask probing questions to help the user discover the answer themselves.',
  ),
  makeBuiltinTemplate(
    'eli5',
    'ELI5',
    'Explain everything like the user is 5 years old. Use simple language, analogies, and examples a child would understand.',
  ),
]

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  selectedTemplateId?: string | null
  onTemplateSelected?: (templateId: string | null) => void
}

export function SystemPromptEditor({
  value,
  onChange,
  onClose,
  selectedTemplateId,
  onTemplateSelected,
}: SystemPromptEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [draftSessionKey, setDraftSessionKey] = useState(0)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { customTemplates, setCustomTemplates } = useCustomTemplates()

  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates])
  const selectedCustomTemplate = useMemo(
    () => customTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [customTemplates, selectedTemplateId],
  )
  const isEditingCustomTemplate = Boolean(selectedCustomTemplate)
  const nameInputKey = selectedTemplateId ?? `draft-${draftSessionKey}`

  const getDraftName = () => nameInputRef.current?.value.trim() ?? ''

  const resetDraft = () => {
    setDraftSessionKey((current) => current + 1)
  }

  const selectTemplate = (template: Preset) => {
    onChange(template.system_prompt ?? '')
    setShowTemplates(false)

    if (template.is_builtin || !isCustomTemplateId(template.id)) {
      onTemplateSelected?.(null)
      resetDraft()
      return
    }

    onTemplateSelected?.(template.id)
  }

  const handleCreateTemplate = () => {
    const nextName = getDraftName()
    if (!nextName || !value.trim()) return

    const template = createCustomTemplate(nextName, value)
    setCustomTemplates((current) => [...current, template])
    onTemplateSelected?.(template.id)
  }

  const handleUpdateTemplate = () => {
    const nextName = getDraftName()
    if (!selectedCustomTemplate || !nextName || !value.trim()) return

    setCustomTemplates((current) =>
      current.map((template) =>
        template.id === selectedCustomTemplate.id
          ? {
              ...template,
              name: nextName,
              system_prompt: value,
            }
          : template,
      ),
    )
  }

  const handleDeleteTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((template) => template.id !== id))
    if (selectedTemplateId === id) {
      onTemplateSelected?.(null)
      resetDraft()
    }
  }

  const startNewTemplate = () => {
    onTemplateSelected?.(null)
    resetDraft()
  }

  return (
    <div className="h-full w-[min(24rem,100vw)] flex-col border-l border-border bg-surface md:flex xl:w-[22rem]">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          System Prompt
        </h3>
        <button onClick={onClose} className="ui-icon-button" type="button">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="space-y-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex w-full items-center justify-between border border-border bg-surface-dim px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
            >
              <span className="truncate text-left">
                {selectedCustomTemplate ? `${selectedCustomTemplate.name} template` : 'Templates'}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`}
              />
            </button>

            {showTemplates && (
              <div className="ui-panel absolute left-0 top-full z-10 mt-2 max-h-72 w-full overflow-y-auto">
                {allTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="group flex items-center border-b border-border px-2 py-2 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectTemplate(t)
                      }}
                      className="flex-1 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-dim"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-text">
                        {t.name}
                        {!t.is_builtin && (
                          <span className="border border-border bg-surface px-1 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                            custom
                          </span>
                        )}
                      </div>
                      {t.system_prompt && (
                        <div className="mt-0.5 truncate text-xs text-text-muted">
                          {t.system_prompt}
                        </div>
                      )}
                    </button>
                    {!t.is_builtin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="ui-icon-button mr-1 h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-error"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border border-border bg-surface-dim px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">
                {isEditingCustomTemplate ? 'Editing custom template' : 'Draft prompt'}
              </p>
              <p className="text-xs text-text-muted">
                {isEditingCustomTemplate
                  ? 'Save your changes directly to the selected template.'
                  : 'Create a reusable template from this prompt when it is ready.'}
              </p>
            </div>
            {isEditingCustomTemplate && (
              <button type="button" onClick={startNewTemplate} className="ui-button ui-button-secondary px-3 py-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Template Name
          </label>
          <input
            key={nameInputKey}
            ref={nameInputRef}
            type="text"
            defaultValue={selectedCustomTemplate?.name ?? ''}
            placeholder="e.g. Precise Technical Writer"
            className="ui-input ui-input-soft"
          />
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a system prompt to set the assistant's behavior..."
          className="min-h-[180px] flex-1 resize-none border border-border bg-surface-dim p-3 text-sm text-text placeholder-text-muted outline-none focus:border-primary font-mono"
        />

        <div className="space-y-3 border border-border bg-surface-dim p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-text-muted">
              {value.length}c · ~{Math.ceil(value.length / 4)} tokens
            </span>
            {selectedCustomTemplate && (
              <button
                type="button"
                onClick={() => handleDeleteTemplate(selectedCustomTemplate.id)}
                className="ui-button ui-button-danger px-3 py-2 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCustomTemplate ? (
              <button
                type="button"
                onClick={handleUpdateTemplate}
                disabled={!value.trim()}
                className="ui-button ui-button-primary"
              >
                <PencilLine className="h-4 w-4" />
                Save Changes
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={!value.trim()}
                className="ui-button ui-button-primary"
              >
                <Save className="h-4 w-4" />
                Save as Template
              </button>
            )}
            <p className="text-xs leading-relaxed text-text-muted">
              {selectedCustomTemplate
                ? 'Updates keep this template in place so it stays selected everywhere you use it.'
                : 'Create a saved template once and reuse it from the preset picker.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
