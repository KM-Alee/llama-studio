import { afterEach, describe, expect, it, vi } from 'vitest'

import { createConversation, exportConversationMarkdown, getModels, streamChat } from '@/lib/api'

describe('api helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not attach a JSON content type header to GET requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await getModels()

    const [, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('adds JSON content type headers for requests with a body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '1', title: 'Test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await createConversation({ title: 'Test' })

    const [, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('returns markdown exports as text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('# Export', {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }),
    )

    await expect(exportConversationMarkdown('abc')).resolves.toBe('# Export')
  })

  it('surfaces backend error messages for markdown exports', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(exportConversationMarkdown('missing')).rejects.toThrow('Conversation not found')
  })

  it('surfaces backend error messages for chat streams', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'llama.cpp server is not running' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const iterator = streamChat([{ role: 'user', content: 'Hello' }])
    await expect(iterator.next()).rejects.toThrow('llama.cpp server is not running')
  })
})
