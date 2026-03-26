import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  tokensUsed?: number
  generationTimeMs?: number
}

interface ChatState {
  activeConversationId: string | null
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  setActiveConversation: (id: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setStreaming: (isStreaming: boolean) => void
  appendStreamContent: (content: string) => void
  clearStreamContent: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamContent: () => set({ streamingContent: '' }),
}))
