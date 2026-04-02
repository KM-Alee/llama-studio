import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Cpu, HardDrive, Info, Microchip, Gauge, Rocket } from 'lucide-react'
import { getConfig, updateConfig, detectHardware, getServerFlags, setServerFlags, type AppConfig, type HardwareInfo } from '@/lib/api'
import { useAppStore, type Theme } from '@/stores/appStore'
import toast from 'react-hot-toast'
import { formatBytes } from '@/lib/utils'

const DEFAULT_FORM: AppConfig = {
  llama_cpp_path: '',
  models_directory: '',
  default_profile: 'normal',
  theme: 'system',
  llama_server_port: 8080,
  app_port: 3000,
  context_size: 4096,
  gpu_layers: -1,
  threads: 0,
  flash_attention: true,
  batch_size: null,
  ubatch_size: null,
  rope_scaling: null,
  rope_freq_base: null,
  rope_freq_scale: null,
  mmap: null,
  mlock: null,
  cont_batching: true,
}

function SettingsCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-2 border-border bg-surface-dim p-5">
      <h2 className="mb-0.5 text-sm font-bold text-text">{title}</h2>
      {description && <p className="mb-4 text-xs text-text-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  )
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-medium text-text-secondary">{children}</span>
      {hint && (
        <span className="text-xs text-text-muted" title={hint}>
          <Info className="inline h-3.5 w-3.5" />
        </span>
      )}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <div>
        <span className="text-sm font-medium text-text">{label}</span>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
    </div>
  )
}

const HARDWARE_PRESETS = [
  { name: 'CPU Only', icon: Cpu, desc: 'No GPU acceleration', config: { gpu_layers: 0, threads: 0, flash_attention: false, mmap: true, mlock: false } },
  { name: 'Low VRAM', icon: Microchip, desc: '4-6 GB GPU', config: { gpu_layers: 20, threads: 0, flash_attention: true, mmap: true, mlock: false } },
  { name: 'Mid VRAM', icon: Gauge, desc: '8-12 GB GPU', config: { gpu_layers: -1, threads: 0, flash_attention: true, mmap: true, mlock: false } },
  { name: 'High VRAM', icon: Rocket, desc: '16+ GB GPU', config: { gpu_layers: -1, threads: 0, flash_attention: true, mmap: false, mlock: true, cont_batching: true } },
]

function SettingsEditor({
  initialConfig,
  initialFlags,
  hardware,
  profile,
  theme,
  setTheme,
}: {
  initialConfig: AppConfig
  initialFlags: string[]
  hardware?: HardwareInfo
  profile: 'normal' | 'advanced'
  theme: Theme
  setTheme: (theme: Theme) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AppConfig>(initialConfig)
  const [customFlags, setCustomFlags] = useState(initialFlags.join(' '))

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateConfig({
        ...form,
        theme,
        default_profile: profile,
      })
      if (profile === 'advanced') {
        const flags = customFlags.trim().split(/\s+/).filter(Boolean)
        await setServerFlags(flags)
      }
    },
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['server-flags'] })
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save settings'),
  })

  const applyPreset = (preset: typeof HARDWARE_PRESETS[number]) => {
    setForm((current) => ({ ...current, ...preset.config }))
    toast.success(`Applied "${preset.name}" preset`)
  }

  const inputClass = 'w-full border-2 border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder-text-muted focus:border-primary'

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">Configure Llama Studio and llama.cpp</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 border-2 border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <div className="space-y-4">
        <SettingsCard title="Appearance" description="Customize how Llama Studio looks">
          <label className="block">
            <FieldLabel>Theme</FieldLabel>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              className={inputClass}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </SettingsCard>

        <SettingsCard title="Llama Studio" description="Frontend and server wiring">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel hint="HTTP port used by the Llama Studio backend. Restart the app after changing it.">App Port</FieldLabel>
              <input
                type="number"
                value={form.app_port}
                onChange={(event) => setForm({ ...form, app_port: Number(event.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        </SettingsCard>

        <SettingsCard title="llama.cpp" description="Server binary and model storage settings">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel hint="Path to llama-server binary. Leave empty to use PATH.">Binary Path</FieldLabel>
              <input
                type="text"
                value={form.llama_cpp_path}
                onChange={(event) => setForm({ ...form, llama_cpp_path: event.target.value })}
                placeholder="Leave empty for PATH"
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Directory where GGUF model files are stored.">Models Directory</FieldLabel>
              <input
                type="text"
                value={form.models_directory}
                onChange={(event) => setForm({ ...form, models_directory: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Port for the llama.cpp HTTP server.">Server Port</FieldLabel>
              <input
                type="number"
                value={form.llama_server_port}
                onChange={(event) => setForm({ ...form, llama_server_port: Number(event.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        </SettingsCard>

        <SettingsCard title="Quick Setup" description="Choose a preset matching your hardware">
          <div className="grid grid-cols-2 gap-2">
            {HARDWARE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-3 border border-border p-3 text-left transition-colors hover:border-primary hover:bg-surface-hover"
              >
                <div className="flex h-8 w-8 items-center justify-center border border-border bg-surface">
                  <preset.icon className="h-4 w-4 text-text-secondary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text">{preset.name}</div>
                  <div className="text-xs text-text-muted">{preset.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title="Performance" description="GPU, threading, and memory settings">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel hint="Maximum context window size in tokens.">Context Size</FieldLabel>
              <input
                type="number"
                value={form.context_size}
                onChange={(event) => setForm({ ...form, context_size: Number(event.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Number of model layers to offload to GPU. -1 offloads all layers.">GPU Layers</FieldLabel>
              <input
                type="number"
                value={form.gpu_layers}
                onChange={(event) => setForm({ ...form, gpu_layers: Number(event.target.value) })}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-text-muted">-1 = all layers on GPU, 0 = CPU only</span>
            </label>
            <label className="block">
              <FieldLabel hint="Number of CPU threads for inference. 0 = auto-detect.">Threads</FieldLabel>
              <input
                type="number"
                value={form.threads}
                onChange={(event) => setForm({ ...form, threads: Number(event.target.value) })}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-text-muted">0 = auto-detect</span>
            </label>
            <Toggle
              checked={form.flash_attention}
              onChange={(value) => setForm({ ...form, flash_attention: value })}
              label="Flash Attention"
              description="Faster inference with reduced memory usage"
            />
          </div>
        </SettingsCard>

        {profile === 'advanced' && (
          <>
            <SettingsCard title="Batching" description="Token batching for throughput tuning">
              <div className="space-y-4">
                <label className="block">
                  <FieldLabel hint="Prompt processing batch size. Higher = faster prompt processing, more VRAM.">Batch Size</FieldLabel>
                  <input
                    type="number"
                    value={form.batch_size ?? ''}
                    onChange={(event) => setForm({ ...form, batch_size: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Default (512)"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <FieldLabel hint="Micro-batch size for prompt processing.">Micro-batch Size</FieldLabel>
                  <input
                    type="number"
                    value={form.ubatch_size ?? ''}
                    onChange={(event) => setForm({ ...form, ubatch_size: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Default (512)"
                    className={inputClass}
                  />
                </label>
                <Toggle
                  checked={form.cont_batching !== false && form.cont_batching != null}
                  onChange={(value) => setForm({ ...form, cont_batching: value })}
                  label="Continuous Batching"
                  description="Process multiple requests simultaneously"
                />
              </div>
            </SettingsCard>

            <SettingsCard title="Memory" description="Memory mapping and locking options">
              <div className="space-y-4">
                <Toggle
                  checked={form.mmap !== false}
                  onChange={(value) => setForm({ ...form, mmap: value })}
                  label="Memory-Mapped I/O (mmap)"
                  description="Map model file into memory. Faster startup, shared between processes."
                />
                <Toggle
                  checked={Boolean(form.mlock)}
                  onChange={(value) => setForm({ ...form, mlock: value })}
                  label="Memory Lock (mlock)"
                  description="Prevent model from being swapped to disk. Requires sufficient RAM."
                />
              </div>
            </SettingsCard>

            <SettingsCard title="RoPE" description="Rotary Position Embedding configuration for extended context">
              <div className="space-y-4">
                <label className="block">
                  <FieldLabel hint="RoPE scaling method: none, linear, yarn">Scaling Method</FieldLabel>
                  <select
                    value={form.rope_scaling ?? ''}
                    onChange={(event) => setForm({ ...form, rope_scaling: event.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">Default (none)</option>
                    <option value="linear">Linear</option>
                    <option value="yarn">YaRN</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel hint="Base frequency for RoPE.">Frequency Base</FieldLabel>
                  <input
                    type="number"
                    step="any"
                    value={form.rope_freq_base ?? ''}
                    onChange={(event) => setForm({ ...form, rope_freq_base: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Default (model-specific)"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <FieldLabel hint="Frequency scaling factor for RoPE.">Frequency Scale</FieldLabel>
                  <input
                    type="number"
                    step="any"
                    value={form.rope_freq_scale ?? ''}
                    onChange={(event) => setForm({ ...form, rope_freq_scale: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Default (1.0)"
                    className={inputClass}
                  />
                </label>
              </div>
            </SettingsCard>

            <SettingsCard title="Custom Flags" description="Raw CLI flags for llama-server">
              <label className="block">
                <input
                  type="text"
                  value={customFlags}
                  onChange={(event) => setCustomFlags(event.target.value)}
                  placeholder="--verbose-prompt --log-disable"
                  className={`${inputClass} font-mono`}
                />
                <span className="mt-1 block text-xs text-text-muted">
                  Space-separated flags passed directly to llama-server
                </span>
              </label>
            </SettingsCard>
          </>
        )}

        {hardware && (
          <SettingsCard title="Hardware" description="Detected system specifications">
            <div className="grid grid-cols-2 gap-3">
              {hardware.cpu_cores && (
                <div className="flex items-center gap-3 border border-border bg-surface p-4">
                  <Cpu className="h-5 w-5 shrink-0 text-text-muted" />
                  <div>
                    <div className="text-sm font-semibold text-text">{hardware.cpu_cores} cores</div>
                    <div className="text-xs text-text-muted">CPU</div>
                  </div>
                </div>
              )}
              {hardware.total_ram_bytes && (
                <div className="flex items-center gap-3 border border-border bg-surface p-4">
                  <HardDrive className="h-5 w-5 shrink-0 text-text-muted" />
                  <div>
                    <div className="text-sm font-semibold text-text">{formatBytes(hardware.total_ram_bytes)}</div>
                    <div className="text-xs text-text-muted">RAM</div>
                  </div>
                </div>
              )}
            </div>
          </SettingsCard>
        )}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const profile = useAppStore((s) => s.profile)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  })

  const { data: hardware } = useQuery({
    queryKey: ['hardware'],
    queryFn: detectHardware,
    staleTime: 60_000,
  })

  const { data: flagsData } = useQuery({
    queryKey: ['server-flags'],
    queryFn: getServerFlags,
    enabled: profile === 'advanced',
  })

  if (configLoading) {
    return (
      <div className="mx-auto flex h-full max-w-2xl items-center justify-center p-6">
        <div className="text-sm text-text-muted">Loading settings...</div>
      </div>
    )
  }

  if (!config || configError) {
    return (
      <div className="mx-auto flex h-full max-w-2xl items-center justify-center p-6">
        <div className="text-sm text-error">Failed to load settings.</div>
      </div>
    )
  }

  return (
    <SettingsEditor
      key={`${config.app_port}-${config.llama_server_port}-${config.context_size}-${(flagsData?.flags ?? []).join(' ')}`}
      initialConfig={{ ...DEFAULT_FORM, ...config }}
      initialFlags={flagsData?.flags ?? []}
      hardware={hardware?.hardware}
      profile={profile}
      theme={theme}
      setTheme={setTheme}
    />
  )
}
