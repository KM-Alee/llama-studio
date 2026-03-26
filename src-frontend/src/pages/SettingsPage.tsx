import { useQuery, useMutation } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { getConfig, updateConfig } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const profile = useAppStore((s) => s.profile)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
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

  useEffect(() => {
    if (config) {
      setForm((prev) => ({ ...prev, ...config }))
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save settings'),
  })

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">Configure AI Studio</p>
        </div>
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <div className="space-y-8">
        {/* Appearance */}
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Appearance
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-text mb-1 block">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </section>

        {/* llama.cpp */}
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            llama.cpp
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-text mb-1 block">llama.cpp Path</span>
              <input
                type="text"
                value={form.llama_cpp_path}
                onChange={(e) => setForm({ ...form, llama_cpp_path: e.target.value })}
                placeholder="Leave empty to use PATH"
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none placeholder-text-muted"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text mb-1 block">Models Directory</span>
              <input
                type="text"
                value={form.models_directory}
                onChange={(e) => setForm({ ...form, models_directory: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text mb-1 block">Server Port</span>
              <input
                type="number"
                value={form.llama_server_port}
                onChange={(e) => setForm({ ...form, llama_server_port: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              />
            </label>
          </div>
        </section>

        {/* Advanced Settings - only visible in advanced mode */}
        {profile === 'advanced' && (
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              Advanced
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-text mb-1 block">Context Size</span>
                <input
                  type="number"
                  value={form.context_size}
                  onChange={(e) => setForm({ ...form, context_size: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text mb-1 block">GPU Layers (-1 = all)</span>
                <input
                  type="number"
                  value={form.gpu_layers}
                  onChange={(e) => setForm({ ...form, gpu_layers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text mb-1 block">Threads (0 = auto)</span>
                <input
                  type="number"
                  value={form.threads}
                  onChange={(e) => setForm({ ...form, threads: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-dim border border-border text-text text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.flash_attention}
                  onChange={(e) => setForm({ ...form, flash_attention: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">Flash Attention</span>
              </label>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
