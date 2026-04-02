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
      <div className="absolute inset-0 bg-black/40" />
      <div
        className={cn(
          'relative w-full max-w-md mx-4 border-2 border-border bg-surface shadow-[4px_4px_0px_var(--color-border)]',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-bold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
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
          className="border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={cn(
            'border-2 px-4 py-2 text-sm font-semibold text-white transition-colors',
            confirmVariant === 'danger'
              ? 'border-error bg-error hover:bg-error/90'
              : 'border-primary bg-primary hover:bg-primary-hover'
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
        className="w-full border-2 border-border bg-surface-dim px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder-text-muted focus:border-primary"
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {submitLabel}
        </button>
      </div>
    </Modal>
  )
}
