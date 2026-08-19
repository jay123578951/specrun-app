/**
 * 執行形態偵測：runtime 判定讓同一份 dist 同時服務 web 與桌面兩形態，
 * 不需雙 build 通路。`__TAURI_INTERNALS__` 由 Tauri webview 注入。
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
