import { useState } from 'react'
import { X, ChevronDown, Plus, Trash2, Save } from 'lucide-react'
import type { Preset } from '@/lib/api'
import { createCustomTemplate, useCustomTemplates } from '@/lib/customTemplates'

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
  makeBuiltinTemplate('helpful', 'Helpful Assistant', 'You are a helpful, harmless, and honest assistant.'),
  makeBuiltinTemplate('creative', 'Creative Writer', 'You are a creative writing assistant. Be imaginative and expressive.'),
  makeBuiltinTemplate('coder', 'Code Expert', 'You are an expert programmer. Write clean, efficient, well-documented code. Explain your reasoning.'),
  makeBuiltinTemplate('analyst', 'Data Analyst', 'You are a data analysis expert. Be precise, use numbers, and present findings clearly.'),
  makeBuiltinTemplate('tutor', 'Patient Tutor', 'You are a patient and knowledgeable tutor. Explain concepts step by step, check understanding, and use examples.'),
  makeBuiltinTemplate('concise', 'Concise', 'Be extremely concise. Answer in as few words as possible while remaining accurate and helpful.'),
  makeBuiltinTemplate('socratic', 'Socratic Guide', 'You are a Socratic teacher. Never give answers directly — instead ask probing questions to help the user discover the answer themselves.'),
  makeBuiltinTemplate('eli5', 'ELI5', 'Explain everything like the user is 5 years old. Use simple language, analogies, and examples a child would understand.'),
]

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onTemplateCreated?: (template: Preset) => void
}

export function SystemPromptEditor({ value, onChange, onClose, onTemplateCreated }: SystemPromptEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const { customTemplates, setCustomTemplates } = useCustomTemplates()

  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates]

  const handleSaveAsTemplate = () => {
    if (!newName.trim() || !value.trim()) return
    const template = createCustomTemplate(newName.trim(), value)
    setCustomTemplates((current) => [...current, template])
    onTemplateCreated?.(template)
    setNewName('')
    setIsCreating(false)
  }

  const handleDeleteTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="w-80 border-l-2 border-border bg-surface h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b-2 border-border">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">System Prompt</h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-surface-dim text-text-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
        {/* Template selector */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-surface-dim border border-border text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <span>Templates</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          {showTemplates && (
            <div className="absolute z-10 w-full mt-1 bg-surface border-2 border-border shadow-[4px_4px_0px_var(--color-border)] overflow-hidden max-h-64 overflow-y-auto">
              {allTemplates.map((t) => (
                <div key={t.id} className="flex items-center group border-b border-border last:border-b-0">
                  <button
                    onClick={() => {
                      onChange(t.system_prompt ?? '')
                      setShowTemplates(false)
                    }}
                    className="flex-1 text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-dim transition-colors"
                  >
                    <div className="font-medium text-text flex items-center gap-1.5">
                      {t.name}
                      {!t.is_builtin && <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted bg-surface-dim border border-border px-1">custom</span>}
                    </div>
                    {t.system_prompt && (
                      <div className="text-xs text-text-muted truncate mt-0.5">{t.system_prompt}</div>
                    )}
                  </button>
                  {!t.is_builtin && (
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 mr-2 opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a system prompt to set the assistant's behavior..."
          className="flex-1 w-full bg-surface-dim border border-border p-3 text-sm text-text placeholder-text-muted resize-none focus:outline-none focus:border-primary min-h-[120px] font-mono"
        />

        {/* Save as template / stats */}
        <div className="space-y-2">
          {isCreating ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate() }}
                placeholder="Template name..."
                className="flex-1 px-3 py-1.5 bg-surface-dim border border-border text-sm text-text placeholder-text-muted outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={handleSaveAsTemplate}
                disabled={!newName.trim() || !value.trim()}
                className="p-1.5 bg-primary text-white hover:bg-primary-hover disabled:opacity-30 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewName('') }}
                className="p-1.5 text-text-muted hover:bg-surface-dim transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-text-muted">
                {value.length}c · ~{Math.ceil(value.length / 4)} tokens
              </span>
              {value.trim() && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Save as template
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
