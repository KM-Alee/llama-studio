import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, User, Bot } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '@/stores/chatStore'
import { cn } from '@/lib/utils'

interface Props {
  message: ChatMessage
  isStreaming?: boolean
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : '')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          isUser ? 'bg-primary text-white' : 'bg-surface-dim border border-border text-text-secondary'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-white rounded-tr-md'
            : 'bg-surface-dim border border-border text-text rounded-tl-md'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <div className="relative group/code my-3">
                      <pre className="bg-[#0d1117] text-gray-300 rounded-lg p-4 overflow-x-auto text-xs">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                      <button
                        onClick={() => {
                          const text = String(children).replace(/\n$/, '')
                          navigator.clipboard.writeText(text)
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 opacity-0 group-hover/code:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
        )}
      </div>

      {/* Actions (on hover) */}
      {!isUser && !isStreaming && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </motion.div>
  )
})
