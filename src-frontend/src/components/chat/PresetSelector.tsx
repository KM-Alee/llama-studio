import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sliders, ChevronDown } from 'lucide-react'
import { getPresets, type Preset } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
  selectedPresetId: string | null
  onSelect: (preset: Preset | null) => void
}

export function PresetSelector({ selectedPresetId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['presets'],
    queryFn: getPresets,
  })

  const presets = data?.presets ?? []
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
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span className="max-w-[60px] truncate">{selectedPreset ? selectedPreset.name : 'Default'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
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
                  : 'text-text-secondary hover:bg-surface-hover',
              )}
            >
              <div className="font-medium">Default</div>
              <p className="mt-0.5 text-xs text-text-muted">Standard settings</p>
            </button>
            {presets.map((preset: Preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onSelect(preset)
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors',
                  selectedPresetId === preset.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-surface-hover',
                )}
              >
                <div className="font-medium">{preset.name}</div>
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
