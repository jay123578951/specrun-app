use tauri_plugin_fs::FsExt;

#[derive(serde::Serialize)]
struct SpawnResult {
  status: Option<i32>,
  stdout: String,
  stderr: String,
}

/// 動態程式路徑＋動態 cwd 的外部指令執行。shell plugin 白名單是編譯期
/// 靜態的，無法表達使用者設定的 CLI 路徑，故直包 std::process::Command。
#[tauri::command]
fn spawn_bin(program: String, args: Vec<String>, cwd: String) -> Result<SpawnResult, String> {
  let output = std::process::Command::new(&program)
    .args(&args)
    .current_dir(&cwd)
    .output()
    .map_err(|e| format!("failed to spawn `{program}`: {e}"))?;
  Ok(SpawnResult {
    status: output.status.code(),
    stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
    stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
  })
}

/// runtime 擴充 fs scope。遞迴 allow 不含 dotfile 目錄，而 park 機制依賴
/// `.git/specrun-app/` 讀寫，故同一呼叫內對 `.git` 補顯式 allow。
#[tauri::command]
fn allow_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let scope = app.fs_scope();
  scope.allow_directory(&path, true).map_err(|e| e.to_string())?;
  let git = std::path::Path::new(&path).join(".git");
  if git.is_dir() {
    scope.allow_directory(&git, true).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![spawn_bin, allow_path])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
