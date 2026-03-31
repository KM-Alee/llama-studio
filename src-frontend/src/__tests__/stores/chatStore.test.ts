import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, type ChatMessage } from '@/stores/chatStore'

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  role: 'user',
  content: 'Hello',
  createdAt: new Date().toISOString(),
  ...overrides,
})

function resetStore() {
  useChatStore.setState({
    activeConversationId: null,
    messages: [],
    isStreaming: false,
    streamingContent: '',
  })
}

describe('chatStore', () => {
  beforeEach(resetStore)

  it('has correct initial state', () => {
    const state = useChatStore.getState()
    expect(state.activeConversationId).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.streamingContent).toBe('')
  })

  it('setActiveConversation updates the id', () => {
    useChatStore.getState().setActiveConversation('conv-abc')
    expect(useChatStore.getState().activeConversationId).toBe('conv-abc')
  })

  it('setActiveConversation can be cleared to null', () => {
    useChatStore.getState().setActiveConversation('conv-abc')
    useChatStore.getState().setActiveConversation(null)
    expect(useChatStore.getState().activeConversationId).toBeNull()
  })

  it('setMessages replaces messages array', () => {
    const msgs = [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })]
    useChatStore.getState().setMessages(msgs)
    expect(useChatStore.getState().messages).toHaveLength(2)
    expect(useChatStore.getState().messages[0].id).toBe('a')
  })

  it('addMessage appends to messages', () => {
    useChatStore.getState().addMessage(makeMessage({ id: 'first' }))
    useChatStore.getState().addMessage(makeMessage({ id: 'second' }))
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].id).toBe('second')
  })

  it('setStreaming updates isStreaming', () => {
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
    useChatStore.getState().setStreaming(false)
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  it('appendStreamContent accumulates chunks', () => {
    useChatStore.getState().appendStreamContent('Hello')
    useChatStore.getState().appendStreamContent(', world')
    expect(useChatStore.getState().streamingContent).toBe('Hello, world')
  })

  it('clearStreamContent resets to empty string', () => {
    useChatStore.getState().appendStreamContent('some content')
    useChatStore.getState().clearStreamContent()
    expect(useChatStore.getState().streamingContent).toBe('')
  })
})
