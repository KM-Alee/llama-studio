import { memo, useState } from 'react'
import { Copy, Check, FileCode2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/stores/chatStore'
import { formatBytes } from '@/lib/utils'
import { getAttachmentLanguage } from '@/lib/chatAttachments'
import { MarkdownRenderer } from './MarkdownRenderer'

interface Props {
  message: ChatMessage
  isStreaming?: boolean
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const attachments = message.attachments ?? []

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex justify-end"
      >
        <div className="max-w-[82%] min-w-0">
          {attachments.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {attachments.map((attachment) => {
                const preview = attachment.content.slice(0, 800)
                const isTruncated = attachment.content.length > preview.length
                return (
                  <details
                    key={attachment.id}
                    className="border border-border bg-surface-dim"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate font-medium text-text">{attachment.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {getAttachmentLanguage(attachment.name)} · {formatBytes(attachment.size_bytes)}
                      </span>
                    </summary>
                    <pre className="overflow-x-auto border-t border-border bg-[#0e0e0c] px-4 py-3 text-xs leading-6 text-white/85">
                      <code>{isTruncated ? `${preview}\n…` : preview}</code>
                    </pre>
                  </details>
                )
              })}
            </div>
          )}
          {message.content && (
            <div className="border-l-[3px] border-l-primary border border-border bg-user-bubble px-4 py-3">
              <MarkdownRenderer content={message.content} tone="user" />
            </div>
          )}
          {!message.content && attachments.length > 0 && (
            <div className="border-l-[3px] border-l-primary border border-border bg-user-bubble px-4 py-2.5 text-sm text-text-secondary">
              Attached {attachments.length} file{attachments.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group flex gap-4"
    >
      <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full overflow-hidden border-2 border-border bg-surface-dim">
        <img src="/ai-face.jpeg" alt="AI avatar" className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        {attachments.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {attachments.map((attachment) => {
              const preview = attachment.content.slice(0, 800)
              const isTruncated = attachment.content.length > preview.length
              return (
                <details key={attachment.id} className="border border-border bg-surface-dim">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate font-medium text-text">{attachment.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {getAttachmentLanguage(attachment.name)} · {formatBytes(attachment.size_bytes)}
                    </span>
                  </summary>
                  <pre className="overflow-x-auto border-t border-border bg-[#0e0e0c] px-4 py-3 text-xs leading-6 text-white/85">
                    <code>{isTruncated ? `${preview}\n…` : preview}</code>
                  </pre>
                </details>
              )
            })}
          </div>
        )}

        {message.content ? (
          <MarkdownRenderer content={message.content} tone="assistant" />
        ) : attachments.length > 0 ? (
          <p className="text-sm text-text-secondary">
            Attached {attachments.length} file{attachments.length === 1 ? '' : 's'}.
          </p>
        ) : null}

        {isStreaming && (
          <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-[2px] bg-primary animate-pulse" />
        )}

        {!isStreaming && (message.tokensUsed || message.generationTimeMs) && (
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted/60 select-none">
            {message.tokensUsed && <span>{message.tokensUsed} tok</span>}
            {message.tokensUsed && message.generationTimeMs && <span className="opacity-40">·</span>}
            {message.generationTimeMs && <span>{(message.generationTimeMs / 1000).toFixed(1)}s</span>}
            {message.tokensUsed && message.generationTimeMs && message.generationTimeMs > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span>{((message.tokensUsed / message.generationTimeMs) * 1000).toFixed(0)} tok/s</span>
              </>
            )}
          </div>
        )}
      </div>

      {!isStreaming && message.content && (
        <div className="flex shrink-0 items-start pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="Copy"
            aria-label="Copy response"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </motion.div>
  )
})
