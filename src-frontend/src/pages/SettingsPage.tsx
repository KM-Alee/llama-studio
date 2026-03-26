import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Cpu, HardDrive } from 'lucide-react'
import { getConfig, updateConfig, detectHardware, getServerFlags, setServerFlags } from '@/lib/api'
import { useAppStore, type Theme } from '@/stores/appStore'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatBytes } from '@/lib/utils'

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

  const [form, setForm] = useState({
    llama_cpp_path: '',
    models_directory: '',
    llama_server_port: 8080,
    context_size: 4096,
    gpu_layers: -1,
    threads: 0,
    flash_attention: true,
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

  return (
    <div className="max-w-xl mx-auto p-6">
      {configLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-text-muted">Loading settings...</div>
        </div>
      ) : (
      <>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-text">Settings</h1>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover text-xs font-medium transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <section>
          <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            Appearance
          </h2>
          <label className="block">
            <span className="text-xs text-text-secondary mb-1 block">Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>

        {/* llama.cpp */}
        <section>
          <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            llama.cpp
          </h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-text-secondary mb-1 block">Binary Path</span>
              <input
                type="text"
                value={form.llama_cpp_path}
                onChange={(e) => setForm({ ...form, llama_cpp_path: e.target.value })}
                placeholder="Leave empty for PATH"
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none placeholder-text-muted"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary mb-1 block">Models Directory</span>
              <input
                type="text"
                value={form.models_directory}
                onChange={(e) => setForm({ ...form, models_directory: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary mb-1 block">Server Port</span>
              <input
                type="number"
                value={form.llama_server_port}
                onChange={(e) => setForm({ ...form, llama_server_port: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
              />
            </label>
          </div>
        </section>

        {/* Advanced Settings - only visible in advanced mode */}
        {profile === 'advanced' && (
          <section>
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
              Advanced
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-text-secondary mb-1 block">Context Size</span>
                <input
                  type="number"
                  value={form.context_size}
                  onChange={(e) => setForm({ ...form, context_size: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-secondary mb-1 block">GPU Layers (-1 = all)</span>
                <input
                  type="number"
                  value={form.gpu_layers}
                  onChange={(e) => setForm({ ...form, gpu_layers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-secondary mb-1 block">Threads (0 = auto)</span>
                <input
                  type="number"
                  value={form.threads}
                  onChange={(e) => setForm({ ...form, threads: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none"
                />
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.flash_attention}
                  onChange={(e) => setForm({ ...form, flash_attention: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
                />
                <span className="text-sm text-text">Flash Attention</span>
              </label>
              <label className="block">
                <span className="text-xs text-text-secondary mb-1 block">Custom CLI Flags</span>
                <input
                  type="text"
                  value={customFlags}
                  onChange={(e) => setCustomFlags(e.target.value)}
                  placeholder="--mlock --no-mmap"
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none placeholder-text-muted font-mono"
                />
                <span className="text-[11px] text-text-muted mt-1 block">
                  Extra flags for llama-server
                </span>
              </label>
            </div>
          </section>
        )}

        {/* Hardware Info */}
        {hardware?.hardware && (
          <section>
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
              Hardware
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {hardware.hardware.cpu_cores && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-surface-dim border border-border">
                  <Cpu className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-text">{hardware.hardware.cpu_cores} cores</div>
                    <div className="text-[11px] text-text-muted">CPU</div>
                  </div>
                </div>
              )}
              {hardware.hardware.total_ram_bytes && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-surface-dim border border-border">
                  <HardDrive className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-text">{formatBytes(hardware.hardware.total_ram_bytes)}</div>
                    <div className="text-[11px] text-text-muted">RAM</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </>)}
    </div>
  )
}
