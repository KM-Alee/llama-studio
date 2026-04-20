import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sliders, ChevronDown } from 'lucide-react'
import { getPresets, type Preset } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCustomTemplates } from '@/lib/customTemplates'

interface Props {
  selectedPresetId: string | null
  onSelect: (preset: Preset | null) => void
}

export function PresetSelector({ selectedPresetId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { customTemplates } = useCustomTemplates()

  const { data } = useQuery({
    queryKey: ['presets'],
    queryFn: getPresets,
  })

  const presets = [...(data?.presets ?? []), ...customTemplates]
  const selectedPreset = presets.find((preset: Preset) => preset.id === selectedPresetId)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 border border-border px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-dim"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span className="max-w-[60px] truncate">
          {selectedPreset ? selectedPreset.name : 'Default'}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="ui-panel absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden">
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                !selectedPresetId
                  ? 'border-l-2 border-l-primary bg-surface-dim text-primary'
                  : 'border-l-2 border-l-transparent text-text-secondary hover:bg-surface-dim',
              )}
            >
              <div className="font-medium">Default</div>
              <p className="mt-0.5 text-xs text-text-muted">Standard settings</p>
            </button>
            {presets.map((preset: Preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelect(preset)
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors',
                  selectedPresetId === preset.id
                    ? 'border-l-2 border-l-primary bg-surface-dim text-primary'
                    : 'border-l-2 border-l-transparent text-text-secondary hover:bg-surface-dim',
                )}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span>{preset.name}</span>
                  {!preset.is_builtin && (
                    <span className="border border-border bg-surface px-1 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                      custom
                    </span>
                  )}
                </div>
                {preset.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                    {preset.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
