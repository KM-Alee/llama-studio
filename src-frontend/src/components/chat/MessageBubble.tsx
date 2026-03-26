import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, Bot, User } from 'lucide-react'
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
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-5 prose-headings:mb-2 prose-pre:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-p:leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-surface-dim px-1.5 py-0.5 rounded-md text-xs font-mono text-primary-light" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <div className="relative group/code my-3">
                      <pre className="bg-[#161614] text-[#d4d4c8] rounded-xl p-4 overflow-x-auto text-sm leading-relaxed border border-border/50">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                      <button
                        onClick={() => {
                          const text = String(children).replace(/\n$/, '')
                          navigator.clipboard.writeText(text)
                        }}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/10 opacity-0 group-hover/code:opacity-100 transition-opacity text-white/60 hover:text-white/90"
                      >
                        <Copy className="w-3.5 h-3.5" />
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
