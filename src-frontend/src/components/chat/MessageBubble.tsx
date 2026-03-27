import { memo } from 'react'
import { Copy, Check, Bot, FileCode2 } from 'lucide-react'
import { useState } from 'react'
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
      {/* Avatar - assistant */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-surface-dim border border-border flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-3.5 h-3.5 text-text-muted" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'max-w-[80%] leading-relaxed relative',
          isUser
            ? 'bg-user-bubble rounded-2xl rounded-br-md px-4 py-3 text-sm text-text border border-border/50'
            : 'text-text flex-1 min-w-0'
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
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-text-secondary">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium text-text">{attachment.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {getAttachmentLanguage(attachment.name)} · {formatBytes(attachment.size_bytes)}
                    </span>
                  </summary>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-border/70 bg-[#111111] px-3 py-3 text-xs leading-6 text-white/88">
                    <code>{isTruncated ? `${preview}\n…` : preview}</code>
                  </pre>
                </details>
              )
            })}
          </div>
        )}

        {message.content ? (
          <MarkdownRenderer content={message.content} tone={isUser ? 'user' : 'assistant'} />
        ) : attachments.length > 0 ? (
          <p className="text-sm text-text-secondary">Attached {attachments.length} file{attachments.length === 1 ? '' : 's'}.</p>
        ) : null}

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
        )}
      </div>

      {/* Copy action for assistant messages */}
      {!isUser && !isStreaming && message.content && (
        <div className="flex items-start pt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleCopy}
            className="p-1 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </motion.div>
  )
})
