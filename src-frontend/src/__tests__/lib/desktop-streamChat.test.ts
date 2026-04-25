import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

import { streamChat } from '@/lib/platform/desktop'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Let the async generator pass invoke + three listen() awaits and block on waitForItem. */
async function flushUntilStreaming() {
  for (let i = 0; i < 32; i += 1) {
    await Promise.resolve()
  }
}

describe('desktop streamChat', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(listen).mockReset()
  })

  it('filters chunks by request_id, yields deltas, then completes on done', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'start_chat_stream') return 'rid-1'
      if (cmd === 'cancel_chat_stream') return undefined
      throw new Error(`unexpected invoke: ${cmd}`)
    })

    const byChannel: Record<string, Array<(e: { payload: unknown }) => void>> = {}
    vi.mocked(listen).mockImplementation(
      ((channel: string, cb: (e: { payload: unknown }) => void) => {
        ;(byChannel[channel] ??= []).push(cb)
        return Promise.resolve(() => {})
      }) as typeof listen,
    )

    const gen = streamChat([{ role: 'user', content: 'hi' }])
    const first = gen.next()

    await flushUntilStreaming()
    byChannel['chat://chunk']?.forEach((cb) =>
      cb({ payload: { request_id: 'other', data: 'ignored' } }),
    )
    byChannel['chat://chunk']?.forEach((cb) =>
      cb({
        payload: {
          request_id: 'rid-1',
          data: JSON.stringify({
            choices: [{ delta: { content: 'X' } }],
          }),
        },
      }),
    )
    byChannel['chat://done']?.forEach((cb) => cb({ payload: { request_id: 'rid-1' } }))

    const r1 = await first
    expect(r1.done).toBe(false)
    expect(r1.value).toBe('X')

    const r2 = await gen.next()
    expect(r2.done).toBe(true)
  })

  it('rejects when chat://error is emitted for this request', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'start_chat_stream') return 'rid-err'
      throw new Error(`unexpected invoke: ${cmd}`)
    })
    const byChannel: Record<string, Array<(e: { payload: unknown }) => void>> = {}
    vi.mocked(listen).mockImplementation(
      ((channel: string, cb: (e: { payload: unknown }) => void) => {
        ;(byChannel[channel] ??= []).push(cb)
        return Promise.resolve(() => {})
      }) as typeof listen,
    )

    const gen = streamChat([{ role: 'user', content: 'x' }])
    const p = gen.next()

    await flushUntilStreaming()
    byChannel['chat://error']?.forEach((cb) =>
      cb({ payload: { request_id: 'rid-err', message: 'boom' } }),
    )

    await expect(p).rejects.toThrow('boom')
  })
})
