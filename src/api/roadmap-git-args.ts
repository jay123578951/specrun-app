/** web 與桌面版共用的 git 讀取參數與上限；兩邊各自負責執行（design D3） */

export const GIT_TIMEOUT_MS = 5000
export const GIT_MAX_BUFFER = 16 * 1024 * 1024

// `--no-show-signature`、`--root` 讓輸出不受使用者的 `log.showSignature`、`log.showRoot` 設定影響
export const LOG_ARGS = ['log', '--no-show-signature', '--root', '--format=@%at', '--name-only', '-z', '--relative', '--', '.']
// `diff` 預設會順手重寫 `.git/index`，`diff.autoRefreshIndex=false` 關掉這個行為
export const CHANGED_ARGS = ['--no-optional-locks', '-c', 'diff.autoRefreshIndex=false', 'diff', '--numstat', '--no-renames', '-z', '--relative', 'HEAD', '--', '.']
export const TRACKED_ARGS = ['ls-files', '-z', '--', '.']
