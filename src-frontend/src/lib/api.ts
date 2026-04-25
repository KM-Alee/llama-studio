import { isDesktopRuntime } from './platform/env'
import type { AppConfig, UiPreferences } from './apiTypes'
import * as desktop from './platform/desktop'
import * as web from './platform/web'

export * from './apiTypes'

const impl = isDesktopRuntime() ? desktop : web

export const getHealth = () => impl.getHealth()
export const getModels = () => impl.getModels()
export const scanModels = () => impl.scanModels()
export const deleteModel = (id: string) => impl.deleteModel(id)
export const importModel = (path: string) => impl.importModel(path)
export const getDownloads = () => impl.getDownloads()
export const startDownload = (url: string, filename: string) => impl.startDownload(url, filename)
export const cancelDownload = (id: string) => impl.cancelDownload(id)
export const searchHuggingFace = (q: string, limit?: number) => impl.searchHuggingFace(q, limit)
export const getHuggingFaceFiles = (repoId: string) => impl.getHuggingFaceFiles(repoId)
export const getModelInspection = (id: string) => impl.getModelInspection(id)
export const getModelAnalytics = (id: string) => impl.getModelAnalytics(id)
export const startServer = (modelId: string, extraArgs?: string[]) => impl.startServer(modelId, extraArgs)
export const stopServer = () => impl.stopServer()
export const getServerStatus = () => impl.getServerStatus()
export const getServerLogs = () => impl.getServerLogs()
export const getServerFlags = () => impl.getServerFlags()
export const setServerFlags = (flags: string[]) => impl.setServerFlags(flags)
export const getDependencyStatus = () => impl.getDependencyStatus()
export const getServerMetrics = () => impl.getServerMetrics()
export const detectHardware = () => impl.detectHardware()
export const getConversations = () => impl.getConversations()
export const createConversation: typeof web.createConversation = (data) =>
  impl.createConversation(data)
export const getConversation = (id: string) => impl.getConversation(id)
export const deleteConversation = (id: string) => impl.deleteConversation(id)
export const searchConversations = (q: string) => impl.searchConversations(q)
export const exportConversationJson = (id: string) => impl.exportConversationJson(id)
export const exportConversationMarkdown = (id: string) => impl.exportConversationMarkdown(id)
export const forkConversation: typeof web.forkConversation = (id, afterMessageId) =>
  impl.forkConversation(id, afterMessageId)
export const updateConversation: typeof web.updateConversation = (id, data) =>
  impl.updateConversation(id, data)
export const deleteMessage: typeof web.deleteMessage = (conversationId, messageId) =>
  impl.deleteMessage(conversationId, messageId)
export const getMessages = (conversationId: string) => impl.getMessages(conversationId)
export const addMessage: typeof web.addMessage = (conversationId, data) =>
  impl.addMessage(conversationId, data)
export const streamChat: typeof web.streamChat = (messages, params, signal) =>
  impl.streamChat(messages, params, signal)
export const getPresets = () => impl.getPresets()
export const createPreset: typeof web.createPreset = (data) => impl.createPreset(data)
export const deletePreset = (id: string) => impl.deletePreset(id)
export const getConfig = () => impl.getConfig() as Promise<AppConfig>
export const updateConfig: typeof web.updateConfig = (data) => impl.updateConfig(data)

export const getUiPreferences: () => Promise<UiPreferences> = isDesktopRuntime()
  ? () => desktop.getUiPreferences()
  : () => Promise.reject(new Error('getUiPreferences is only available in the desktop app'))

export const setUiPreferences = (appPrefs?: unknown, customTemplates?: unknown) => {
  if (!isDesktopRuntime()) {
    return Promise.reject(new Error('setUiPreferences is only available in the desktop app'))
  }
  return desktop.setUiPreferences(appPrefs, customTemplates)
}

export const mergeBrowserUiMigration = (appPrefs?: unknown, customTemplates?: unknown) => {
  if (!isDesktopRuntime()) {
    return Promise.reject(new Error('mergeBrowserUiMigration is only available in the desktop app'))
  }
  return desktop.mergeBrowserUiMigration(appPrefs, customTemplates)
}
