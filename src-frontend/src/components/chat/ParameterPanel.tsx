import { X, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export interface InferenceParams {
  temperature: number
  top_p: number
  top_k: number
  min_p: number
  repeat_penalty: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number
  typical_p: number
  tfs_z: number
  mirostat: number
  mirostat_tau: number
  mirostat_eta: number
}

export const MAX_TOKENS_AUTO = 0
export const MAX_TOKENS_LIMIT = 8192

const DEFAULTS: InferenceParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  min_p: 0.05,
  repeat_penalty: 1.05,
  max_tokens: MAX_TOKENS_AUTO,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: -1,
  typical_p: 1.0,
  tfs_z: 1.0,
  mirostat: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-20 border border-border bg-surface px-2.5 py-1.5 text-right text-xs text-text outline-none focus:border-primary"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      {description && <p className="text-xs text-text-muted leading-relaxed">{description}</p>}
    </div>
  )
}

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 hover:text-text-secondary transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
      </button>
      {open && <div className="space-y-4 pl-0.5">{children}</div>}
    </div>
  )
}

export function ParameterPanel({ params, onChange, onClose }: ParameterPanelProps) {
  const update = (key: keyof InferenceParams, value: number) => {
    onChange({ ...params, [key]: value })
  }

  return (
    <div className="h-full w-[min(22rem,100vw)] overflow-y-auto border-l border-border bg-surface xl:w-[20rem]">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-sm font-bold text-text">Parameters</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULTS })}
            className="ui-icon-button h-9 w-9"
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button h-9 w-9"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <Section title="Sampling" defaultOpen={true}>
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
            description="Nucleus sampling — cumulative probability threshold"
          />
          <SliderRow
            label="Top K"
            value={params.top_k}
            min={0}
            max={200}
            step={1}
            onChange={(v) => update('top_k', v)}
            description="Number of top tokens to consider (0 = disabled)"
          />
          <SliderRow
            label="Min P"
            value={params.min_p}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update('min_p', v)}
            description="Minimum probability relative to top token"
          />
          <SliderRow
            label="Typical P"
            value={params.typical_p}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update('typical_p', v)}
            description="Locally typical sampling (1.0 = disabled)"
          />
          <SliderRow
            label="TFS Z"
            value={params.tfs_z}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update('tfs_z', v)}
            description="Tail free sampling (1.0 = disabled)"
          />
        </Section>

        <Section title="Penalties" defaultOpen={true}>
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
            label="Frequency Penalty"
            value={params.frequency_penalty}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => update('frequency_penalty', v)}
            description="Reduce repetition based on token frequency"
          />
          <SliderRow
            label="Presence Penalty"
            value={params.presence_penalty}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => update('presence_penalty', v)}
            description="Reduce repetition of any appeared token"
          />
        </Section>

        <Section title="Mirostat" defaultOpen={false}>
          <SliderRow
            label="Mode"
            value={params.mirostat}
            min={0}
            max={2}
            step={1}
            onChange={(v) => update('mirostat', v)}
            description="0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0"
          />
          <SliderRow
            label="Tau"
            value={params.mirostat_tau}
            min={0}
            max={10}
            step={0.1}
            onChange={(v) => update('mirostat_tau', v)}
            description="Target entropy (perplexity)"
          />
          <SliderRow
            label="Eta"
            value={params.mirostat_eta}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update('mirostat_eta', v)}
            description="Learning rate"
          />
        </Section>

        <Section title="Generation" defaultOpen={true}>
          <SliderRow
            label="Max Tokens"
            value={params.max_tokens}
            min={0}
            max={MAX_TOKENS_LIMIT}
            step={64}
            onChange={(v) => update('max_tokens', v)}
            description="0 = auto, or set a hard cap up to 8192"
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
        </Section>
      </div>
    </div>
  )
}

export { DEFAULTS as DEFAULT_PARAMS }
