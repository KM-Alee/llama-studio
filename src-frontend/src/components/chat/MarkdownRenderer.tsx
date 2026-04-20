import { useState, type ReactNode } from 'react'
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

function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  if (Array.isArray(children)) {
    return children.map((child) => extractTextContent(child)).join('')
  }

  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextContent((children as { props?: { children?: ReactNode } }).props?.children)
  }

  return ''
}

function CodeBlock({ className, children }: { className?: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = extractTextContent(children).replace(/\n$/, '')
  const language = className?.replace('language-', '') || 'text'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="my-4 overflow-hidden border-l-[3px] border-l-primary border border-[#2a2a26] bg-[#0e0e0c]">
      <div className="flex items-center justify-between border-b border-[#2a2a26] px-4 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40 transition-colors hover:text-white/70"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'copied!' : 'copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-[1.7]">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

export function MarkdownRenderer({ content, tone = 'assistant' }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'chat-markdown text-[0.9375rem] leading-[1.75]',
        tone === 'user' && 'chat-markdown-user',
      )}
    >
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
                className="font-medium text-primary underline decoration-primary/40 underline-offset-3 hover:decoration-primary"
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="md-table-wrapper">
                <table>{children}</table>
              </div>
            )
          },
          ul({ children }) {
            return <ul className="md-list md-list-unordered">{children}</ul>
          },
          ol({ children }) {
            return <ol className="md-list md-list-ordered">{children}</ol>
          },
          li({ children }) {
            return <li className="md-list-item">{children}</li>
          },
          p({ children }) {
            return <p className="md-paragraph">{children}</p>
          },
          code({ className, children }) {
            const textContent = extractTextContent(children)
            const isBlock = Boolean(className) || textContent.includes('\n')
            if (!isBlock) {
              return <code>{children}</code>
            }
            return <CodeBlock className={className}>{children}</CodeBlock>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
