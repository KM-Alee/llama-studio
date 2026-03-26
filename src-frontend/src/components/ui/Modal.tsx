import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className={cn(
          'relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-150',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <h2 className="text-base font-bold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', confirmVariant = 'danger'
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-secondary mb-5">{description}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors',
            confirmVariant === 'danger'
              ? 'bg-error hover:bg-error/90'
              : 'bg-primary hover:bg-primary-hover'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

interface InputModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  description?: string
  placeholder?: string
  submitLabel?: string
  initialValue?: string
}

export function InputModal({
  open, onClose, onSubmit, title, description,
  placeholder, submitLabel = 'Submit', initialValue = ''
}: InputModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = () => {
    const val = inputRef.current?.value?.trim()
    if (val) {
      onSubmit(val)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && <p className="text-sm text-text-secondary mb-3">{description}</p>}
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        className="w-full px-3 py-2.5 rounded-xl bg-surface-dim border border-border text-text text-sm focus:border-primary outline-none placeholder-text-muted"
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  )
}
