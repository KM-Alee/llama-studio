import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sliders, ChevronDown } from 'lucide-react'
import { getPresets, type Preset } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
  selectedPresetId: string | null
  onSelect: (presetId: string | null) => void
}

export function PresetSelector({ selectedPresetId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['presets'],
    queryFn: getPresets,
  })

  const presets = data?.presets ?? []
  const selectedPreset = presets.find((p: Preset) => p.id === selectedPresetId)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-surface-hover border border-border transition-colors h-8"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span className="max-w-[60px] truncate">{selectedPreset ? selectedPreset.name : 'Default'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-60 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                !selectedPresetId
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-surface-hover text-text-secondary'
              )}
            >
              <div className="font-medium">Default</div>
              <p className="text-xs text-text-muted mt-0.5">Standard settings</p>
            </button>
            {presets.map((preset: Preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onSelect(preset.id)
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors',
                  selectedPresetId === preset.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-surface-hover text-text-secondary'
                )}
              >
                <div className="font-medium">{preset.name}</div>
                {preset.description && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
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
