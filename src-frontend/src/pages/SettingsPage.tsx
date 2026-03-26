import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Cpu, HardDrive, Info, Zap } from 'lucide-react'
import { getConfig, updateConfig, detectHardware, getServerFlags, setServerFlags } from '@/lib/api'
import { useAppStore, type Theme } from '@/stores/appStore'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatBytes } from '@/lib/utils'

function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-dim p-5">
      <h2 className="text-sm font-bold text-text mb-0.5">{title}</h2>
      {description && <p className="text-xs text-text-muted mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm text-text-secondary font-medium">{children}</span>
      {hint && (
        <span className="text-xs text-text-muted" title={hint}>
          <Info className="w-3.5 h-3.5 inline" />
        </span>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string
}) {
  return (
    <label className="flex items-center gap-3 py-2 px-1 rounded-lg cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <div>
        <span className="text-sm font-medium text-text">{label}</span>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

// Quick presets for common hardware configurations
const HARDWARE_PRESETS = [
  { name: 'CPU Only', icon: '🖥️', desc: 'No GPU acceleration', config: { gpu_layers: 0, threads: 0, flash_attention: false, mmap: true, mlock: false } },
  { name: 'Low VRAM', icon: '📊', desc: '4-6 GB GPU', config: { gpu_layers: 20, threads: 0, flash_attention: true, mmap: true, mlock: false } },
  { name: 'Mid VRAM', icon: '⚡', desc: '8-12 GB GPU', config: { gpu_layers: -1, threads: 0, flash_attention: true, mmap: true, mlock: false } },
  { name: 'High VRAM', icon: '🚀', desc: '16+ GB GPU', config: { gpu_layers: -1, threads: 0, flash_attention: true, mmap: false, mlock: true, cont_batching: true } },
]

export function SettingsPage() {
  const profile = useAppStore((s) => s.profile)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const queryClient = useQueryClient()

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  })

  const { data: hardware } = useQuery({
    queryKey: ['hardware'],
    queryFn: detectHardware,
    staleTime: 60000,
  })

  const { data: flagsData } = useQuery({
    queryKey: ['server-flags'],
    queryFn: getServerFlags,
    enabled: profile === 'advanced',
  })

  const [form, setForm] = useState<Record<string, unknown>>({
    llama_cpp_path: '',
    models_directory: '',
    llama_server_port: 8080,
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
  })

  const [customFlags, setCustomFlags] = useState('')

  useEffect(() => {
    if (config) {
      setForm((prev) => ({ ...prev, ...config }))
    }
  }, [config])

  useEffect(() => {
    if (flagsData?.flags) {
      setCustomFlags(flagsData.flags.join(' '))
    }
  }, [flagsData])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateConfig(form)
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
    onError: () => toast.error('Failed to save settings'),
  })

  const applyPreset = (preset: typeof HARDWARE_PRESETS[0]) => {
    setForm((prev) => ({ ...prev, ...preset.config }))
    toast.success(`Applied "${preset.name}" preset`)
  }

  const inputClass = "w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text text-sm focus:border-primary outline-none placeholder-text-muted transition-colors"

  return (
    <div className="max-w-2xl mx-auto p-6">
      {configLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-text-muted">Loading settings...</div>
        </div>
      ) : (
      <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-muted mt-1">Configure Llama Studio and llama.cpp</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <div className="space-y-4">
        {/* Appearance */}
        <SettingsCard title="Appearance" description="Customize how Llama Studio looks">
          <label className="block">
            <FieldLabel>Theme</FieldLabel>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className={inputClass}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </SettingsCard>

        {/* llama.cpp */}
        <SettingsCard title="llama.cpp" description="Server binary and model storage settings">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel hint="Path to llama-server binary. Leave empty to use PATH.">Binary Path</FieldLabel>
              <input
                type="text"
                value={String(form.llama_cpp_path ?? '')}
                onChange={(e) => setForm({ ...form, llama_cpp_path: e.target.value })}
                placeholder="Leave empty for PATH"
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Directory where GGUF model files are stored.">Models Directory</FieldLabel>
              <input
                type="text"
                value={String(form.models_directory ?? '')}
                onChange={(e) => setForm({ ...form, models_directory: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Port for the llama.cpp HTTP server.">Server Port</FieldLabel>
              <input
                type="number"
                value={Number(form.llama_server_port ?? 8080)}
                onChange={(e) => setForm({ ...form, llama_server_port: parseInt(e.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        </SettingsCard>

        {/* Quick Setup — hardware presets */}
        <SettingsCard title="Quick Setup" description="Choose a preset matching your hardware">
          <div className="grid grid-cols-2 gap-2">
            {HARDWARE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-surface-hover hover:border-primary/30 text-left transition-colors"
              >
                <span className="text-lg">{preset.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-text">{preset.name}</div>
                  <div className="text-xs text-text-muted">{preset.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* Performance */}
        <SettingsCard title="Performance" description="GPU, threading, and memory settings">
          <div className="space-y-4">
            <label className="block">
              <FieldLabel hint="Maximum context window size in tokens.">Context Size</FieldLabel>
              <input
                type="number"
                value={Number(form.context_size ?? 4096)}
                onChange={(e) => setForm({ ...form, context_size: parseInt(e.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Number of model layers to offload to GPU. -1 offloads all layers.">GPU Layers</FieldLabel>
              <input
                type="number"
                value={Number(form.gpu_layers ?? -1)}
                onChange={(e) => setForm({ ...form, gpu_layers: parseInt(e.target.value) })}
                className={inputClass}
              />
              <span className="text-xs text-text-muted mt-1 block">-1 = all layers on GPU, 0 = CPU only</span>
            </label>
            <label className="block">
              <FieldLabel hint="Number of CPU threads for inference. 0 = auto-detect.">Threads</FieldLabel>
              <input
                type="number"
                value={Number(form.threads ?? 0)}
                onChange={(e) => setForm({ ...form, threads: parseInt(e.target.value) })}
                className={inputClass}
              />
              <span className="text-xs text-text-muted mt-1 block">0 = auto-detect</span>
            </label>
            <Toggle
              checked={Boolean(form.flash_attention)}
              onChange={(v) => setForm({ ...form, flash_attention: v })}
              label="Flash Attention"
              description="Faster inference with reduced memory usage"
            />
          </div>
        </SettingsCard>

        {/* Advanced Settings - only visible in advanced mode */}
        {profile === 'advanced' && (
          <>
          <SettingsCard title="Batching" description="Token batching for throughput tuning">
            <div className="space-y-4">
              <label className="block">
                <FieldLabel hint="Prompt processing batch size. Higher = faster prompt processing, more VRAM.">Batch Size</FieldLabel>
                <input
                  type="number"
                  value={form.batch_size != null ? Number(form.batch_size) : ''}
                  onChange={(e) => setForm({ ...form, batch_size: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Default (512)"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel hint="Micro-batch size for prompt processing.">Micro-batch Size</FieldLabel>
                <input
                  type="number"
                  value={form.ubatch_size != null ? Number(form.ubatch_size) : ''}
                  onChange={(e) => setForm({ ...form, ubatch_size: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Default (512)"
                  className={inputClass}
                />
              </label>
              <Toggle
                checked={form.cont_batching !== false && form.cont_batching != null}
                onChange={(v) => setForm({ ...form, cont_batching: v })}
                label="Continuous Batching"
                description="Process multiple requests simultaneously"
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Memory" description="Memory mapping and locking options">
            <div className="space-y-4">
              <Toggle
                checked={form.mmap !== false}
                onChange={(v) => setForm({ ...form, mmap: v })}
                label="Memory-Mapped I/O (mmap)"
                description="Map model file into memory. Faster startup, shared between processes."
              />
              <Toggle
                checked={Boolean(form.mlock)}
                onChange={(v) => setForm({ ...form, mlock: v })}
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
                  value={String(form.rope_scaling ?? '')}
                  onChange={(e) => setForm({ ...form, rope_scaling: e.target.value || null })}
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
                  value={form.rope_freq_base != null ? Number(form.rope_freq_base) : ''}
                  onChange={(e) => setForm({ ...form, rope_freq_base: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Default (model-specific)"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel hint="Frequency scaling factor for RoPE.">Frequency Scale</FieldLabel>
                <input
                  type="number"
                  step="any"
                  value={form.rope_freq_scale != null ? Number(form.rope_freq_scale) : ''}
                  onChange={(e) => setForm({ ...form, rope_freq_scale: e.target.value ? parseFloat(e.target.value) : null })}
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
                onChange={(e) => setCustomFlags(e.target.value)}
                placeholder="--verbose-prompt --log-disable"
                className={inputClass + ' font-mono'}
              />
              <span className="text-xs text-text-muted mt-1 block">
                Space-separated flags passed directly to llama-server
              </span>
            </label>
          </SettingsCard>
          </>
        )}

        {/* Hardware Info */}
        {hardware?.hardware && (
          <SettingsCard title="Hardware" description="Detected system specifications">
            <div className="grid grid-cols-2 gap-3">
              {hardware.hardware.cpu_cores && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border">
                  <Cpu className="w-5 h-5 text-text-muted shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-text">{hardware.hardware.cpu_cores} cores</div>
                    <div className="text-xs text-text-muted">CPU</div>
                  </div>
                </div>
              )}
              {hardware.hardware.total_ram_bytes && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border">
                  <HardDrive className="w-5 h-5 text-text-muted shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-text">{formatBytes(hardware.hardware.total_ram_bytes)}</div>
                    <div className="text-xs text-text-muted">RAM</div>
                  </div>
                </div>
              )}
            </div>
          </SettingsCard>
        )}
      </div>
    </>)}
    </div>
  )
}
