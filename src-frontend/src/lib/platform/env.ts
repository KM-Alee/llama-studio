/**
 * True when the UI runs inside the Tauri webview (bundled assets + IPC), not the browser.
 */
export function isDesktopRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
