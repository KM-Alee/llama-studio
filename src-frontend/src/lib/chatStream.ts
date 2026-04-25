/**
 * llama.cpp chat-completions `data:` payload (after the `data: ` line prefix
 * of an SSE line). Same shape for the browser SSE reader and the Tauri stream.
 * Caller should stop the outer stream if `data === "[DONE]"` (do not call this for [DONE]).
 */
export function* yieldDeltasFromChatDataPayload(
  data: string,
): Generator<string, void, void> {
  try {
    const parsed = JSON.parse(data) as {
      error?: { message?: string } | string
      choices?: { delta?: { content?: string } }[]
    }
    if (parsed.error) {
      const message =
        typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error?.message
      if (message) {
        throw new Error(message)
      }
    }
    const delta = parsed.choices?.[0]?.delta?.content
    if (typeof delta === 'string' && delta) {
      yield delta
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Ignore partial fragments until a complete JSON line is buffered (web only).
      return
    }
    throw e
  }
}
