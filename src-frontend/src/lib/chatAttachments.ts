import type { MessageAttachment } from '@/lib/api'

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

const TEXT_FILE_EXTENSIONS = new Set([
  'c',
  'cc',
  'cpp',
  'cs',
  'css',
  'csv',
  'go',
  'h',
  'hpp',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'kt',
  'log',
  'md',
  'php',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
])

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? (parts.at(-1) ?? '') : ''
}

export function isSupportedAttachment(file: File): boolean {
  if (file.type.startsWith('text/')) {
    return true
  }

  return TEXT_FILE_EXTENSIONS.has(getExtension(file.name))
}

export function getAttachmentLanguage(filename: string): string {
  const extension = getExtension(filename)

  const languageMap: Record<string, string> = {
    c: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    css: 'css',
    go: 'go',
    h: 'c',
    hpp: 'cpp',
    html: 'html',
    java: 'java',
    js: 'javascript',
    json: 'json',
    jsx: 'jsx',
    kt: 'kotlin',
    md: 'markdown',
    php: 'php',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    sql: 'sql',
    svg: 'xml',
    toml: 'toml',
    ts: 'typescript',
    tsx: 'tsx',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  }

  return languageMap[extension] ?? 'text'
}

export async function toMessageAttachment(file: File): Promise<MessageAttachment> {
  if (!isSupportedAttachment(file)) {
    throw new Error(`${file.name} is not a supported text or code file`)
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} exceeds the 2 MB attachment limit`)
  }

  const content = await file.text()

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime_type: file.type || 'text/plain',
    size_bytes: file.size,
    content,
  }
}

export function buildMessageForModel(message: {
  content: string
  attachments?: MessageAttachment[]
}): string {
  const sections: string[] = []
  const trimmedContent = message.content.trim()

  if (trimmedContent) {
    sections.push(trimmedContent)
  }

  const attachments = message.attachments ?? []
  if (attachments.length > 0) {
    const attachmentBlocks = attachments.map((attachment) => {
      const language = getAttachmentLanguage(attachment.name)
      return [
        `Attached file: ${attachment.name}`,
        `MIME type: ${attachment.mime_type}`,
        `Size: ${attachment.size_bytes} bytes`,
        `\`\`\`${language}`,
        attachment.content,
        '```',
      ].join('\n')
    })

    sections.push(attachmentBlocks.join('\n\n'))
  }

  return sections.join('\n\n')
}

export function attachmentInputHint(): string {
  return 'Attach text, markdown, JSON, logs, or source files up to 2 MB each.'
}
