import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, Bot } from 'lucide-react'
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex gap-3 group',
        isUser ? 'justify-end' : ''
      )}
    >
      {/* Avatar - assistant only */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-surface-dim border border-border flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-text-muted" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'max-w-[75%] text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5'
            : 'text-text'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mt-4 prose-headings:mb-2 prose-pre:my-2 prose-ul:my-1.5 prose-ol:my-1.5">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children, ...props }) {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-surface-dim px-1 py-0.5 rounded text-xs font-mono text-primary" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <div className="relative group/code my-3">
                      <pre className="bg-[#1a1a18] text-[#d4d4c8] rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                      <button
                        onClick={() => {
                          const text = String(children).replace(/\n$/, '')
                          navigator.clipboard.writeText(text)
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-white/10 opacity-0 group-hover/code:opacity-100 transition-opacity text-white/60 hover:text-white/90"
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
          <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5 rounded-sm" />
        )}
      </div>

      {/* Copy action for assistant messages */}
      {!isUser && !isStreaming && (
        <div className="flex items-start pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </motion.div>
  )
})
