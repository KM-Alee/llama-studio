import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  tone?: 'assistant' | 'user'
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const language = className?.replace('language-', '') || 'text'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="chat-code-block my-3 overflow-hidden rounded-2xl border border-border/70 bg-[#121212] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-white/65 transition-colors hover:bg-white/8 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6 text-white/92">
        <code className={className}>{code}</code>
      </pre>
    </div>
  )
}

export function MarkdownRenderer({ content, tone = 'assistant' }: MarkdownRendererProps) {
  return (
    <div className={cn('chat-markdown text-sm leading-7', tone === 'user' && 'chat-markdown-user')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-border/70">
                <table>{children}</table>
              </div>
            )
          },
          code({ className, children }) {
            const isInline = !className
            if (isInline) {
              return (
                <code className="rounded-md bg-surface-dim px-1.5 py-0.5 font-mono text-[0.92em] text-primary-light">
                  {children}
                </code>
              )
            }

            return <CodeBlock className={className} children={children} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}