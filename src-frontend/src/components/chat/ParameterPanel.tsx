import { useState } from 'react'
import { X, RotateCcw } from 'lucide-react'

export interface InferenceParams {
  temperature: number
  top_p: number
  top_k: number
  repeat_penalty: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number
}

const DEFAULTS: InferenceParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.05,
  max_tokens: -1,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: -1,
}

interface ParameterPanelProps {
  params: InferenceParams
  onChange: (params: InferenceParams) => void
  onClose: () => void
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  description?: string
}

function SliderRow({ label, value, min, max, step, onChange, description }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-20 px-2 py-0.5 text-xs text-right bg-surface-dim border border-border rounded text-text focus:outline-none focus:border-primary"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 bg-surface-dim rounded-full appearance-none cursor-pointer accent-primary"
      />
      {description && (
        <p className="text-[10px] text-text-muted">{description}</p>
      )}
    </div>
  )
}

export function ParameterPanel({ params, onChange, onClose }: ParameterPanelProps) {
  const update = (key: keyof InferenceParams, value: number) => {
    onChange({ ...params, [key]: value })
  }

  return (
    <div className="w-72 border-l border-border bg-surface h-full overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Parameters</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ ...DEFAULTS })}
            className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        <SliderRow
          label="Temperature"
          value={params.temperature}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => update('temperature', v)}
          description="Higher = more creative, lower = more deterministic"
        />
        <SliderRow
          label="Top P"
          value={params.top_p}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update('top_p', v)}
          description="Nucleus sampling threshold"
        />
        <SliderRow
          label="Top K"
          value={params.top_k}
          min={0}
          max={200}
          step={1}
          onChange={(v) => update('top_k', v)}
          description="Number of top tokens to consider"
        />
        <SliderRow
          label="Repeat Penalty"
          value={params.repeat_penalty}
          min={1}
          max={2}
          step={0.05}
          onChange={(v) => update('repeat_penalty', v)}
          description="Penalize repeated tokens"
        />
        <SliderRow
          label="Max Tokens"
          value={params.max_tokens}
          min={-1}
          max={8192}
          step={64}
          onChange={(v) => update('max_tokens', v)}
          description="-1 for unlimited"
        />
        <SliderRow
          label="Frequency Penalty"
          value={params.frequency_penalty}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => update('frequency_penalty', v)}
        />
        <SliderRow
          label="Presence Penalty"
          value={params.presence_penalty}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => update('presence_penalty', v)}
        />
        <SliderRow
          label="Seed"
          value={params.seed}
          min={-1}
          max={999999}
          step={1}
          onChange={(v) => update('seed', v)}
          description="-1 for random"
        />
      </div>
    </div>
  )
}

export { DEFAULTS as DEFAULT_PARAMS }
