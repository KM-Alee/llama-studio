import { create } from 'zustand'
import type { MessageAttachment } from '@/lib/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: MessageAttachment[]
  createdAt: string
  tokensUsed?: number
  generationTimeMs?: number
  isError?: boolean
}

interface ChatState {
  activeConversationId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  abortStreaming: (() => void) | null
  setActiveConversation: (id: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setStreaming: (isStreaming: boolean) => void
  appendStreamContent: (content: string) => void
  clearStreamContent: () => void
  registerAbortStreaming: (abortStreaming: (() => void) | null) => void
  cancelStreaming: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  abortStreaming: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamContent: () => set({ streamingContent: '' }),
  registerAbortStreaming: (abortStreaming) => set({ abortStreaming }),
  cancelStreaming: () =>
    set((state) => {
      state.abortStreaming?.()
      return {
        isStreaming: false,
        streamingContent: '',
        abortStreaming: null,
      }
    }),
}))
