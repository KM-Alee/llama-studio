import { useState, useEffect } from 'react'
import { X, ChevronDown, Plus, Trash2, Save } from 'lucide-react'

const BUILTIN_TEMPLATES = [
  { id: 'none', name: 'None', prompt: '', builtin: true },
  { id: 'helpful', name: 'Helpful Assistant', prompt: 'You are a helpful, harmless, and honest assistant.', builtin: true },
  { id: 'creative', name: 'Creative Writer', prompt: 'You are a creative writing assistant. Be imaginative and expressive.', builtin: true },
  { id: 'coder', name: 'Code Expert', prompt: 'You are an expert programmer. Write clean, efficient, well-documented code. Explain your reasoning.', builtin: true },
  { id: 'analyst', name: 'Data Analyst', prompt: 'You are a data analysis expert. Be precise, use numbers, and present findings clearly.', builtin: true },
  { id: 'tutor', name: 'Patient Tutor', prompt: 'You are a patient and knowledgeable tutor. Explain concepts step by step, check understanding, and use examples.', builtin: true },
  { id: 'concise', name: 'Concise', prompt: 'Be extremely concise. Answer in as few words as possible while remaining accurate and helpful.', builtin: true },
  { id: 'socratic', name: 'Socratic Guide', prompt: 'You are a Socratic teacher. Never give answers directly — instead ask probing questions to help the user discover the answer themselves.', builtin: true },
  { id: 'eli5', name: 'ELI5', prompt: 'Explain everything like the user is 5 years old. Use simple language, analogies, and examples a child would understand.', builtin: true },
]

interface Template {
  id: string
  name: string
  prompt: string
  builtin: boolean
}

const STORAGE_KEY = 'llama-studio-custom-templates'

function loadCustomTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCustomTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function SystemPromptEditor({ value, onChange, onClose }: SystemPromptEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<Template[]>(loadCustomTemplates)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates]

  useEffect(() => {
    saveCustomTemplates(customTemplates)
  }, [customTemplates])

  const handleSaveAsTemplate = () => {
    if (!newName.trim() || !value.trim()) return
    const id = `custom-${Date.now()}`
    setCustomTemplates((prev) => [...prev, { id, name: newName.trim(), prompt: value, builtin: false }])
    setNewName('')
    setIsCreating(false)
  }

  const handleDeleteTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="w-80 border-l border-border bg-surface h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-bold text-text">System Prompt</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
        {/* Template selector */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-surface-dim border border-border rounded-xl text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <span>Templates</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          {showTemplates && (
            <div className="absolute z-10 w-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {allTemplates.map((t) => (
                <div key={t.id} className="flex items-center group">
                  <button
                    onClick={() => {
                      onChange(t.prompt)
                      setShowTemplates(false)
                    }}
                    className="flex-1 text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                  >
                    <div className="font-medium text-text flex items-center gap-1.5">
                      {t.name}
                      {!t.builtin && <span className="text-[10px] text-text-muted bg-surface-dim rounded px-1">custom</span>}
                    </div>
                    {t.prompt && (
                      <div className="text-xs text-text-muted truncate mt-0.5">{t.prompt}</div>
                    )}
                  </button>
                  {!t.builtin && (
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 mr-2 rounded-lg opacity-0 group-hover:opacity-100 text-text-muted hover:text-error hover:bg-error/10 transition-all"
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
          className="flex-1 w-full bg-surface-dim border border-border rounded-xl p-3 text-sm text-text placeholder-text-muted resize-none focus:outline-none focus:border-primary min-h-[120px]"
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-dim border border-border text-sm text-text placeholder-text-muted outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={handleSaveAsTemplate}
                disabled={!newName.trim() || !value.trim()}
                className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-30 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewName('') }}
                className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
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
