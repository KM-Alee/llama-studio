import { memo, useState } from 'react'
import { Copy, Check, Bot, FileCode2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/stores/chatStore'
import { cn, formatBytes } from '@/lib/utils'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('group', isUser ? 'flex justify-end' : 'flex gap-3')}
    >
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-dim">
          <Bot className="w-3.5 h-3.5 text-text-muted" />
        </div>
      )}

      <div
        className={cn(
          'relative max-w-[80%] leading-relaxed',
          isUser
            ? 'rounded-2xl rounded-br-md border border-border/50 bg-user-bubble px-4 py-3 text-sm text-text'
            : 'min-w-0 flex-1 text-text',
        )}
      >
        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((attachment) => {
              const preview = attachment.content.slice(0, 1000)
              const isTruncated = attachment.content.length > preview.length
              return (
                <details
                  key={attachment.id}
                  className="rounded-xl border border-border/70 bg-surface/70 p-3"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm text-text-secondary">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium text-text">{attachment.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {getAttachmentLanguage(attachment.name)} · {formatBytes(attachment.size_bytes)}
                    </span>
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-border/70 bg-surface-dim px-3 py-3 text-xs leading-6 text-text">
                    <code>{isTruncated ? `${preview}
…` : preview}</code>
                  </pre>
                </details>
              )
            })}
          </div>
        )}

        {message.content ? (
          <MarkdownRenderer content={message.content} tone={isUser ? 'user' : 'assistant'} />
        ) : attachments.length > 0 ? (
          <p className="text-sm text-text-secondary">
            Attached {attachments.length} file{attachments.length === 1 ? '' : 's'}.
          </p>
        ) : null}

        {isStreaming && (
          <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-1.5 rounded-sm bg-primary/60 animate-pulse" />
        )}

        {!isUser && !isStreaming && (message.tokensUsed || message.generationTimeMs) && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted/70 select-none">
            {message.tokensUsed && (
              <span>{message.tokensUsed} tok</span>
            )}
            {message.tokensUsed && message.generationTimeMs && (
              <span className="opacity-50">·</span>
            )}
            {message.generationTimeMs && (
              <span>{(message.generationTimeMs / 1000).toFixed(1)}s</span>
            )}
            {message.tokensUsed && message.generationTimeMs && message.generationTimeMs > 0 && (
              <>
                <span className="opacity-50">·</span>
                <span>{((message.tokensUsed / message.generationTimeMs) * 1000).toFixed(0)} tok/s</span>
              </>
            )}
          </div>
        )}
      </div>

      {!isUser && !isStreaming && message.content && (
        <div className="flex shrink-0 items-start pt-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handleCopy}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-hover"
            title="Copy"
            aria-label="Copy response"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </motion.div>
  )
})
