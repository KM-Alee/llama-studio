import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'

const TEMPLATES = [
  { id: 'none', name: 'None', prompt: '' },
  { id: 'helpful', name: 'Helpful Assistant', prompt: 'You are a helpful, harmless, and honest assistant.' },
  { id: 'creative', name: 'Creative Writer', prompt: 'You are a creative writing assistant. Be imaginative and expressive.' },
  { id: 'coder', name: 'Code Expert', prompt: 'You are an expert programmer. Write clean, efficient, well-documented code. Explain your reasoning.' },
  { id: 'analyst', name: 'Data Analyst', prompt: 'You are a data analysis expert. Be precise, use numbers, and present findings clearly.' },
  { id: 'tutor', name: 'Patient Tutor', prompt: 'You are a patient and knowledgeable tutor. Explain concepts step by step, check understanding, and use examples.' },
  { id: 'concise', name: 'Concise Responder', prompt: 'Be extremely concise. Answer in as few words as possible while remaining accurate and helpful.' },
]

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function SystemPromptEditor({ value, onChange, onClose }: SystemPromptEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false)

  return (
    <div className="w-80 border-l border-border bg-surface h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">System Prompt</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col">
        {/* Template selector */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-surface-dim border border-border rounded text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <span>Templates</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showTemplates && (
            <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-md overflow-hidden">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onChange(t.prompt)
                    setShowTemplates(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  <div className="font-medium text-text">{t.name}</div>
                  {t.prompt && (
                    <div className="text-[10px] text-text-muted truncate mt-0.5">{t.prompt}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a system prompt to set the assistant's behavior..."
          className="flex-1 w-full bg-surface-dim border border-border rounded-lg p-3 text-xs text-text placeholder-text-muted resize-none focus:outline-none focus:border-primary min-h-[120px]"
        />

        <div className="text-[10px] text-text-muted">
          {value.length} characters · ~{Math.ceil(value.length / 4)} tokens
        </div>
      </div>
    </div>
  )
}
